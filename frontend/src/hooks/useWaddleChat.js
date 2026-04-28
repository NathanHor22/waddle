import { useState, useRef, useCallback } from 'react'
import { streamMessage } from '../lib/waddleApi'

/**
 * Manages a streaming conversation with the Waddle agent.
 * Maintains message history and a stable threadId for the session.
 */
export function useWaddleChat() {
  const [messages, setMessages]   = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const threadId = useRef(crypto.randomUUID())

  const send = useCallback(async (userText, locationContext) => {
    if (!userText.trim() || isLoading) return

    const assistantId = crypto.randomUUID()

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user',      text: userText },
      { id: assistantId,         role: 'assistant', text: '', streaming: true },
    ])
    setIsLoading(true)

    await streamMessage({
      message: userText,
      locationContext,
      threadId: threadId.current,
      onChunk: (delta) => {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, text: m.text + delta } : m)
        )
      },
      onDone: () => {
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, streaming: false } : m)
        )
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
      },
    })
  }, [isLoading])

  return { messages, isLoading, send }
}
