import type { HeroProps } from '../types'

export default function Hero({ storeName, tagline }: HeroProps) {
  return (
    <section className="bg-[#FAFAF8] py-20 sm:py-28 text-center border-b border-stone-200">
      <div className="max-w-2xl mx-auto px-4">
        <p className="text-xs tracking-[0.3em] uppercase text-[#C9A96E] mb-4">
          {storeName}
        </p>
        <h2 style={{ fontFamily: "'Playfair Display', serif" }} className="text-4xl sm:text-5xl font-semibold text-[#1A1A1A] mb-6 leading-tight">
          {tagline}
        </h2>
        <div className="w-12 h-px bg-[#C9A96E] mx-auto" />
      </div>
    </section>
  )
}
