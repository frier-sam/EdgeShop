import type { FooterProps } from '../types'

export default function Footer({ storeName }: FooterProps) {
  return (
    <footer className="border-t border-stone-200 bg-[#FAFAF8] py-10 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <p style={{ fontFamily: "'Playfair Display', serif" }} className="text-sm tracking-widest uppercase text-[#1A1A1A] mb-2">
          {storeName}
        </p>
        <p className="text-xs text-stone-400">Crafted with care</p>
      </div>
    </footer>
  )
}
