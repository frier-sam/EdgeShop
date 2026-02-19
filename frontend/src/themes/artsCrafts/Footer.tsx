import type { FooterProps } from '../types'

export default function Footer({ storeName }: FooterProps) {
  return (
    <footer className="bg-[#F5F0E8] py-10 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <div className="w-16 h-1 bg-[#C4622D] mx-auto mb-6 rounded-full" />
        <p className="text-sm font-bold tracking-wider uppercase text-[#2C2416] mb-2">
          {storeName}
        </p>
        <p className="text-xs text-amber-500 font-bold tracking-wider">Handmade with love</p>
      </div>
    </footer>
  )
}
