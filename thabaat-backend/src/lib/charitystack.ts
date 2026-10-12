import { createHmac, timingSafeEqual } from 'node:crypto'

export type CharityStackConfig = { apiKey: string; apiBaseUrl: string; mode: 'test' | 'live'; webhookSecret: string }
export function charityStackConfig(env = process.env): CharityStackConfig | null {
  if (env.CHARITYSTACK_ENABLED !== 'true') return null
  const mode = env.CHARITYSTACK_MODE
  if (mode !== 'test' && mode !== 'live') throw new Error('Choose CHARITYSTACK_MODE explicitly')
  const apiKey = env.CHARITYSTACK_API_KEY || ''
  if (!apiKey.startsWith(`cs_${mode}_`)) throw new Error('CharityStack key does not match the selected environment')
  // Support must supply the test API base URL; never guess or fall back to live.
  const apiBaseUrl = env.CHARITYSTACK_API_BASE_URL || ''
  const url = new URL(apiBaseUrl)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/v1')) throw new Error('Invalid CharityStack API base URL')
  return { apiKey, apiBaseUrl: url.toString().replace(/\/$/, ''), mode, webhookSecret: env.CHARITYSTACK_WEBHOOK_SECRET || '' }
}

export function verifyWebhook(raw: Buffer, timestamp: string, signature: string, secret: string, now = Date.now()): boolean {
  if (!secret || !/^\d{10}$/.test(timestamp) || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false
  const expected = createHmac('sha256', secret).update(timestamp + '.').update(raw).digest()
  return timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))
}

export function validateProviderLink(value: unknown, formId: string, linkId: string): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]+$/.test(linkId)) throw new Error('Invalid checkout response')
  const url = new URL(value)
  if (url.protocol !== 'https:' || !['charitystack.com', 'www.charitystack.com'].includes(url.hostname) || url.port || url.username || url.password || url.hash || url.pathname !== `/attend/${formId}` || [...url.searchParams.keys()].length !== 1 || url.searchParams.get('elementid') !== linkId) throw new Error('Invalid checkout response')
  return url.toString()
}

export type CheckoutInput = { orderId: string; formId: string; email: string; ticketName: string; amountCents: number }
export type ProviderLink = { linkID: string; formID: string; checkoutUrl: string }
export type CreateCheckout = (input: CheckoutInput) => Promise<ProviderLink>
export function createCheckoutClient(config: CharityStackConfig, request: typeof fetch = fetch): CreateCheckout {
  return async input => {
    const response = await request(`${config.apiBaseUrl}/forms/${encodeURIComponent(input.formId)}/links`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Thabaat order ${input.orderId}`, destinationType: 'HOSTED_PAGE_ATTEND', prefill: {
        email: input.email, amount: input.amountCents / 100, ticket: input.ticketName,
        attendees: [{ email: input.email }], customInputs: { 'Thabaat app checkout reference': input.orderId },
      } }),
      // returnUrl is proposed by support, not in the published API contract yet.
    })
    if (!response.ok) throw new Error('CharityStack checkout request failed')
    const result = await response.json() as ProviderLink
    if (result.formID !== input.formId || typeof result.linkID !== 'string') throw new Error('Invalid checkout response')
    return { ...result, checkoutUrl: validateProviderLink(result.checkoutUrl, input.formId, result.linkID) }
  }
}
