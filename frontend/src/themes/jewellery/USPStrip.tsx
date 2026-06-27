const DEFAULT_USPS = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
    label: 'Free Shipping',
    sub: 'On orders above ₹999',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Certified Quality',
    sub: 'Hallmarked & verified',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    label: 'Easy Returns',
    sub: '7-day hassle-free returns',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.4} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    label: 'Secure Payments',
    sub: 'SSL encrypted checkout',
  },
]

interface USPStripProps {
  enabled?: boolean
}

export default function USPStrip({ enabled = true }: USPStripProps) {
  if (!enabled) return null

  return (
    <section
      className="border-y py-5"
      style={{ borderColor: 'color-mix(in srgb, var(--color-accent) 20%, transparent)', backgroundColor: 'var(--color-bg)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {DEFAULT_USPS.map((usp) => (
            <li key={usp.label} className="flex items-center gap-3">
              <span style={{ color: 'var(--color-accent)' }}>{usp.icon}</span>
              <div>
                <p className="text-xs font-semibold tracking-wide" style={{ color: 'var(--color-primary)' }}>
                  {usp.label}
                </p>
                <p className="text-[11px] opacity-60" style={{ color: 'var(--color-primary)' }}>
                  {usp.sub}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
