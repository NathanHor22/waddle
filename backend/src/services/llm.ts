import OpenAI from 'openai'

// Single LLM seam for the whole backend. Defaults to Groq (OpenAI-compatible),
// but the base URL / models are env-driven, so swapping provider — back to
// Anthropic's OpenAI-compat endpoint, OpenAI, Together, etc. — is config-only.
const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY ?? process.env.LLM_API_KEY,
  baseURL: process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1',
})

// Two tiers, mirroring the old Haiku/Sonnet split: a fast cheap model for
// classification, a stronger one for replies and extraction.
export const LLM_MODELS = {
  fast: process.env.LLM_MODEL_FAST ?? 'llama-3.1-8b-instant',
  smart: process.env.LLM_MODEL_SMART ?? 'llama-3.3-70b-versatile',
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CompleteParams {
  model: string
  messages: LlmMessage[]
  system?: string
  maxTokens?: number
  json?: boolean // force a JSON-object response (for detection/extraction)
}

// Returns the assistant's text (trimmed), or '' if the model returned nothing.
export async function complete(params: CompleteParams): Promise<string> {
  const messages: LlmMessage[] = params.system
    ? [{ role: 'system', content: params.system }, ...params.messages]
    : params.messages

  const response = await client.chat.completions.create({
    model: params.model,
    max_tokens: params.maxTokens ?? 512,
    messages,
    ...(params.json ? { response_format: { type: 'json_object' } } : {}),
  })

  return response.choices[0]?.message?.content?.trim() ?? ''
}
