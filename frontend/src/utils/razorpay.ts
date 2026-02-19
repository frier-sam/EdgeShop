interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  order_id: string
  prefill: { name: string; email: string; contact: string }
  onSuccess: (response: {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }) => void
  onFailure: () => void
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: new (options: Record<string, unknown>) => { open: () => void }
  }
}

export function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
    document.body.appendChild(script)
  })
}

export function openRazorpayModal(options: RazorpayOptions): void {
  const rzp = new window.Razorpay({
    key: options.key,
    amount: options.amount,
    currency: options.currency,
    name: options.name,
    order_id: options.order_id,
    prefill: options.prefill,
    handler: options.onSuccess,
    modal: { ondismiss: options.onFailure },
  })
  rzp.open()
}
