import type { ParsedQuotation } from '../types.js'

const BASE = 'https://graph.facebook.com/v18.0'

function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<string> {
  const res = await fetch(`${BASE}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: normalisePhone(to),
      type: 'text',
      text: { body },
    }),
  })

  const data = await res.json() as Record<string, any>
  if (!res.ok) throw new Error(data.error?.message ?? 'WhatsApp API error')
  return data.messages[0].id as string
}

export function buildNegotiationMessage(params: {
  supplier: string
  product: string
  quantity: string
  targetPrice: string
}): string {
  const { supplier, product, quantity, targetPrice } = params
  return `Hi ${supplier},

We found you through Waddle, a procurement platform. We're interested in procuring *${product}*.

Details:
• Quantity: ${quantity}
• Target price: ${targetPrice}

Could you please share:
1. Your best price for this quantity
2. MOQ (minimum order quantity)
3. Lead time / delivery time
4. Payment terms

Thank you!`
}

export function parseQuotation(text: string): ParsedQuotation {
  const priceMatch = text.match(/(?:RM|MYR|SGD|USD|\$|£)\s?[\d,]+(?:\.\d{1,2})?/i)
  const moqMatch = text.match(/(?:MOQ|minimum order)[:\s]+([^\n.]+)/i)
  const leadMatch = text.match(/(?:lead time|delivery|dispatch)[:\s]+([^\n.]+)/i)

  return {
    price: priceMatch?.[0]?.trim() ?? null,
    moq: moqMatch?.[1]?.trim() ?? null,
    leadTime: leadMatch?.[1]?.trim() ?? null,
    raw: text,
  }
}
