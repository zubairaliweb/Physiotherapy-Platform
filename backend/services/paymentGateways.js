const providers = new Map()

export function registerPaymentGateway(name, adapter) {
  if (!name || typeof adapter?.createCheckoutSession !== 'function' || typeof adapter?.verifyWebhook !== 'function') throw new TypeError('A payment gateway needs checkout and webhook verification methods.')
  providers.set(name, adapter)
}

export function getPaymentGateway(name = process.env.PAYMENT_GATEWAY) {
  return providers.get(name) || null
}

export async function createCheckoutSession(payment, context) {
  const gateway = getPaymentGateway()
  if (!gateway) {
    const error = new Error('No payment provider is configured. Record an external payment or configure a gateway adapter.')
    error.status = 503
    throw error
  }
  return gateway.createCheckoutSession(payment, context)
}
