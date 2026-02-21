import { useEffect } from 'react'
import { Link } from 'react-router-dom'

function setNoIndex() {
  let el = document.querySelector('meta[name="robots"]')
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', 'robots')
    document.head.appendChild(el)
  }
  el.setAttribute('content', 'noindex, nofollow')
  return () => el!.setAttribute('content', '')
}

export default function OrderSuccessPage() {
  useEffect(() => setNoIndex(), [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-sm px-4">
        <div className="text-4xl mb-4">✓</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-sm text-gray-500 mb-6">Thank you for your purchase. You'll receive a confirmation shortly.</p>
        <Link to="/" className="inline-block px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700">
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
