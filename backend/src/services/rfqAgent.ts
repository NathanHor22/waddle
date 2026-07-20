import { complete, LLM_MODELS } from './llm.js'
import type { RfqSpec } from '../types.js'

export interface RfqCapture {
  spec: RfqSpec
  // Up to 2 questions for genuinely missing critical fields. Empty when the
  // spec is complete enough to source against.
  clarifyingQuestions: string[]
}

// Turns "I need 200L of 12% sodium hypochlorite to Shah Alam by Friday, ~RM4k"
// into a structured spec. The agent does the structuring — the buyer never fills
// a form. Relative dates resolve against `today`.
export async function captureRfqFromText(text: string, defaultCurrency = 'MYR'): Promise<RfqCapture> {
  const today = new Date().toISOString().slice(0, 10)

  const raw = await complete({
    model: LLM_MODELS.smart,
    maxTokens: 600,
    json: true,
    messages: [
      {
        role: 'user',
        content: `You are a procurement assistant. Extract a structured RFQ from the buyer's request.

Today's date is ${today}. Default currency is ${defaultCurrency}.

Buyer request:
"""${text}"""

Return ONLY valid JSON in exactly this shape — no other text:
{
  "product": "the item/chemical, or empty string if not identifiable",
  "grade": "concentration / grade / purity, or null",
  "quantity": "amount with unit, or null",
  "packaging": "drum/IBC/bag size etc, or null",
  "deliveryLocation": "delivery place, or null",
  "neededBy": "YYYY-MM-DD resolved from relative dates, or null",
  "targetPrice": "budget/target as written, or null",
  "currency": "ISO-ish currency code, default ${defaultCurrency}",
  "clarifyingQuestions": ["at most 2 short questions for the most important MISSING fields"]
}

Rules:
- Only ask about fields that are genuinely missing AND important (product, quantity, grade for chemicals, delivery location, needed-by). Never ask about something already given.
- If product itself is unclear, the first question must establish what they want to buy.`,
      },
    ],
  })

  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('RFQ capture did not return valid JSON')

  const parsed = JSON.parse(match[0]) as Partial<RfqSpec> & { clarifyingQuestions?: unknown }

  const spec: RfqSpec = {
    product: (parsed.product ?? '').trim(),
    grade: parsed.grade ?? null,
    quantity: parsed.quantity ?? null,
    packaging: parsed.packaging ?? null,
    deliveryLocation: parsed.deliveryLocation ?? null,
    neededBy: isIsoDate(parsed.neededBy) ? parsed.neededBy : null,
    targetPrice: parsed.targetPrice ?? null,
    currency: parsed.currency?.trim() || defaultCurrency,
  }

  const clarifyingQuestions = Array.isArray(parsed.clarifyingQuestions)
    ? parsed.clarifyingQuestions.filter((q): q is string => typeof q === 'string' && q.trim() !== '').slice(0, 2)
    : []

  return { spec, clarifyingQuestions }
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
