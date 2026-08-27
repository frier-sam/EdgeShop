// Static copy for the homepage sections (Workstream F, POD-UI2.md §3/F).
//
// `CATEGORIES` and `TRUST_ITEMS` used to have local fallbacks defined here
// for F3 / F2 while storeConfig.ts (owned by the brand/chrome workstream)
// hadn't yet grown those exports (POD-UI2.md §3/E6). They have since
// landed there with the intended curated content — HomePage.tsx now
// imports `CATEGORIES` / `TRUST_ITEMS` straight from '../lib/storeConfig',
// so the fallbacks were removed rather than left as dead code.

// ── How it works (F5) ────────────────────────────────────────────
export interface HowItWorksStep {
  title: string
  description: string
}

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  { title: 'Pick a product', description: 'Tees, hoodies, mugs and more — browse the catalog and choose your base.' },
  { title: 'Add your design', description: 'Upload art or add text on the print area, front and back.' },
  { title: 'We print & ship', description: 'Printed to order and shipped straight to your door.' },
]

// ── Social proof (F6) ────────────────────────────────────────────
// Deliberately generic first names, no surnames, no photos, and no
// specific/verifiable claims (dates, order numbers, delivery times) — see
// POD-UI2.md §1/§3/F6: clearly illustrative placeholder content, not
// fabricated testimonials that read as real reviews.
export interface Testimonial {
  name: string
  rating: number
  quote: string
}

export const TESTIMONIALS: Testimonial[] = [
  { name: 'Aisha', rating: 5, quote: 'Uploading my own artwork and seeing it on a tee before ordering made this so easy.' },
  { name: 'Kabir', rating: 5, quote: 'Print quality is sharp and the mug still looks new after months of use.' },
  { name: 'Meera', rating: 4, quote: 'Loved being able to design the front and back separately. Great for gifting.' },
]
