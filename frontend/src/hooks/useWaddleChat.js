import { useState, useRef, useCallback } from 'react'
import { streamMessage } from '../lib/waddleApi'

const RECOMMENDATIONS_RE = /```recommendations\s*\n([\s\S]*?)\n?```/
const OPTIONS_RE = /```options\s*\n([\s\S]*?)\n?```/

const PROCUREMENT_QUESTIONS = [
  {
    q: 'How many units or items do you need?',
    choices: ['1–10 units', '11–50 units', '50+ units'],
  },
  {
    q: "What's your total budget?",
    choices: ['Under 1,000', '1,000–5,000', '5,000+'],
  },
  {
    q: 'When do you need it by?',
    choices: ['Within 1 week', '2–4 weeks', '1–3 months'],
  },
  {
    q: 'Any specific preferences?',
    choices: ['No preference', 'Local suppliers only', 'Best quality / premium'],
  },
]

function parseRecommendations(text) {
  const match = text.match(RECOMMENDATIONS_RE)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1].trim())
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}
  return null
}

function parseOptionsBlock(text) {
  const match = text.match(OPTIONS_RE)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1].trim())
    if (parsed.q && Array.isArray(parsed.a) && parsed.a.length > 0) {
      return { question: parsed.q, choices: parsed.a }
    }
  } catch {}
  return null
}

function compileProcurementMessage(originalQuery, answers, locationContext) {
  const [qty, budget, timeline, prefs] = answers
  const locationNote = locationContext ? `\n\nLocation context: ${locationContext}` : ''
  return `I'm looking to procure: ${originalQuery}

My requirements:
- Quantity: ${qty}
- Budget: ${budget}
- Timeline: ${timeline}
- Preferences: ${prefs}${locationNote}

Please find me the best 4 suppliers or vendors for this and present your recommendations.`
}

export function useWaddleChat() {
  const [messages, setMessages]    = useState([])
  const [isLoading, setIsLoading]  = useState(false)
  const threadId          = useRef(crypto.randomUUID())
  const lastLocationRef   = useRef(null)
  const flowRef           = useRef(null)   // { originalQuery, answers: [] }
  const flowDoneRef       = useRef(false)  // true after first recommendations shown

  const _streamFromLLM = useCallback(async (llmMessage) => {
    const assistantId = crypto.randomUUID()
    setMessages(prev => [
      ...prev,
      { id: assistantId, role: 'assistant', text: '', streaming: true },
    ])
    setIsLoading(true)

    await streamMessage({
      message: llmMessage,
      locationContext: lastLocationRef.current,
      threadId: threadId.current,
      onChunk: (delta) => {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, text: m.text + delta } : m)
        )
      },
      onDone: () => {
        setMessages(prev => {
          const withDone = prev.map(m =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
          const assistantMsg = withDone.find(m => m.id === assistantId)
          if (!assistantMsg) return withDone

          // Recommendations block
          const recs = parseRecommendations(assistantMsg.text)
          if (recs) {
            const cleanText = assistantMsg.text.replace(RECOMMENDATIONS_RE, '').trim()
            flowDoneRef.current = true
            flowRef.current = null
            return [
              ...withDone.map(m =>
                m.id === assistantId ? { ...m, text: cleanText } : m
              ),
              { id: crypto.randomUUID(), role: 'recommendations', items: recs },
            ]
          }

          // LLM-driven options block (follow-up clarifications)
          const opts = parseOptionsBlock(assistantMsg.text)
          if (opts) {
            const cleanText = assistantMsg.text.replace(OPTIONS_RE, '').trim()
            return [
              ...withDone.map(m =>
                m.id === assistantId ? { ...m, text: cleanText } : m
              ),
              {
                id: crypto.randomUUID(),
                role: 'options',
                question: opts.question,
                choices: opts.choices,
                answered: false,
                selectedChoice: null,
              },
            ]
          }

          flowRef.current = null
          return withDone
        })
        setIsLoading(false)
      },
      onError: (errMsg) => {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantId
              ? { ...m, text: `Something went wrong — ${errMsg}`, streaming: false, error: true }
              : m
          )
        )
        setIsLoading(false)
        flowRef.current = null
      },
    })
  }, [])

  const send = useCallback(async (userText, locationContext) => {
    if (!userText.trim() || isLoading) return

    if (locationContext !== undefined) {
      lastLocationRef.current = locationContext
    }

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: userText },
    ])

    // First message — start 4-question procurement flow
    if (!flowRef.current && !flowDoneRef.current) {
      flowRef.current = { originalQuery: userText, answers: [] }
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'options',
          question: PROCUREMENT_QUESTIONS[0].q,
          choices: PROCUREMENT_QUESTIONS[0].choices,
          answered: false,
          selectedChoice: null,
        },
      ])
      return
    }

    // Follow-up message after flow — direct LLM call
    await _streamFromLLM(userText)
  }, [isLoading, _streamFromLLM])

  const answer = useCallback((questionId, choiceText) => {
    if (!flowRef.current) return

    setMessages(prev =>
      prev.map(m =>
        m.id === questionId
          ? { ...m, answered: true, selectedChoice: choiceText }
          : m
      )
    )

    flowRef.current.answers.push(choiceText)
    const { answers } = flowRef.current
    const nextIndex = answers.length

    if (nextIndex < PROCUREMENT_QUESTIONS.length) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'options',
          question: PROCUREMENT_QUESTIONS[nextIndex].q,
          choices: PROCUREMENT_QUESTIONS[nextIndex].choices,
          answered: false,
          selectedChoice: null,
        },
      ])
    } else {
      // All 4 answered — compile and send to LLM
      const compiled = compileProcurementMessage(
        flowRef.current.originalQuery,
        answers,
        lastLocationRef.current
      )
      _streamFromLLM(compiled)
    }
  }, [_streamFromLLM])

  const negotiate = useCallback(async (company) => {
    const userText = `Negotiate with ${company}`
    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: userText },
    ])
    await _streamFromLLM(
      `Help me negotiate with ${company}. Based on our procurement context, draft a professional message I can send to get a better price or terms.`
    )
  }, [_streamFromLLM])

  return { messages, isLoading, send, answer, negotiate }
}
