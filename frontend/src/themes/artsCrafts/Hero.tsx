import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  return (
    <section className="bg-[#F5F0E8] py-20 sm:py-28 text-center border-b-2 border-amber-200">
      <div className="max-w-2xl mx-auto px-4">
        <p className="text-xs tracking-[0.3em] uppercase text-[#C4622D] font-bold mb-4">
          {storeName}
        </p>
        <h2 className="text-4xl sm:text-5xl font-bold tracking-wider uppercase text-[#2C2416] mb-6 leading-tight">
          {tagline}
        </h2>
        <div className="w-16 h-1 bg-[#C4622D] mx-auto rounded-full" />
      </div>
    </section>
  )
}
