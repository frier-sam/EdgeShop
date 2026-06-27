import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import LinkPicker from '../LinkPicker'

interface CollectionItem {
  label: string
  href: string
}

interface Testimonial {
  name: string
  location: string
  rating: number
  text: string
}

interface HomepageData {
  heroTagline: string
  heroImage: string
  uspEnabled: boolean
  bannerEnabled: boolean
  bannerTitle: string
  bannerSubtitle: string
  bannerImage: string
  bannerHref: string
  bannerCtaLabel: string
  collectionsEnabled: boolean
  collectionItems: CollectionItem[]
  testimonialsEnabled: boolean
  testimonialHeading: string
  testimonials: Testimonial[]
}

const DEFAULT: HomepageData = {
  heroTagline: 'Discover pieces made to be treasured',
  heroImage: '',
  uspEnabled: true,
  bannerEnabled: true,
  bannerTitle: 'The Gold Edit',
  bannerSubtitle: 'Timeless pieces for every occasion — curated with love.',
  bannerImage: '',
  bannerHref: '/shop',
  bannerCtaLabel: 'Explore the Collection',
  collectionsEnabled: true,
  collectionItems: [
    { label: 'Rings', href: '/collections/rings' },
    { label: 'Necklaces', href: '/collections/necklaces' },
    { label: 'Earrings', href: '/collections/earrings' },
    { label: 'Bracelets', href: '/collections/bracelets' },
    { label: 'Sets', href: '/collections/sets' },
  ],
  testimonialsEnabled: true,
  testimonialHeading: 'What Our Customers Say',
  testimonials: [
    { name: 'Priya S.', location: 'Mumbai', rating: 5, text: 'Absolutely beautiful craftsmanship. The necklace I ordered exceeded every expectation.' },
    { name: 'Meera R.', location: 'Bangalore', rating: 5, text: 'Fast shipping and the packaging was stunning. The ring fits perfectly.' },
    { name: 'Ananya K.', location: 'Delhi', rating: 5, text: 'The quality is unreal for the price. My go-to for gifting.' },
  ],
}

const ACCENT = '#B5914E'
const BG = '#FAF8F5'
const DARK = '#2C2A28'

function HomepagePreview({ form }: { form: HomepageData }) {
  const hasCollections = form.collectionsEnabled && (form.collectionItems?.length ?? 0) > 0
  const hasTestimonials = form.testimonialsEnabled && (form.testimonials?.length ?? 0) > 0

  return (
    <div
      className="border border-gray-200 rounded-lg overflow-hidden text-[10px]"
      style={{ backgroundColor: BG, color: DARK }}
    >
      {/* A) Hero */}
      <div className="p-4 relative overflow-hidden" style={{ backgroundColor: BG }}>
        {form.heroImage && (
          <img
            src={form.heroImage}
            className="absolute inset-0 w-full h-full object-cover opacity-20"
            alt=""
          />
        )}
        <div
          className="w-1.5 h-1.5 rounded-full absolute top-3 right-4"
          style={{ backgroundColor: ACCENT }}
        />
        <p
          className="text-[8px] tracking-widest uppercase mb-1"
          style={{ color: ACCENT }}
        >
          STORE NAME
        </p>
        <p
          className="text-sm font-semibold leading-tight mb-2"
          style={{ fontFamily: 'Playfair Display, serif', color: DARK }}
        >
          {form.heroTagline || 'Discover our collection'}
        </p>
        <div className="w-6 h-px mb-2" style={{ backgroundColor: ACCENT }} />
        <span
          className="px-3 py-1 text-[8px] tracking-widest uppercase border"
          style={{ borderColor: DARK, color: BG, backgroundColor: DARK }}
        >
          Shop Now
        </span>
      </div>

      {/* B) USP Strip */}
      {form.uspEnabled && (
        <div className="border-t border-gray-100 px-3 py-2 flex justify-around gap-1">
          {['Free Ship', 'Returns', 'Secure', 'Support'].map(label => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: ACCENT, opacity: 0.3 }}
              />
              <span className="text-[7px] text-gray-500">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* C) Featured Banner */}
      {form.bannerEnabled && (
        <div
          className="border-t border-gray-100 relative overflow-hidden"
          style={{ backgroundColor: DARK, padding: '12px 16px' }}
        >
          {form.bannerImage && (
            <img
              src={form.bannerImage}
              className="absolute inset-0 w-full h-full object-cover opacity-20"
              alt=""
            />
          )}
          <p
            className="text-[7px] tracking-widest uppercase mb-0.5"
            style={{ color: ACCENT }}
          >
            Featured
          </p>
          <p
            className="text-[11px] font-semibold mb-0.5"
            style={{ color: BG, fontFamily: 'Playfair Display, serif' }}
          >
            {form.bannerTitle || 'The Gold Edit'}
          </p>
          <p
            className="text-[8px] mb-2 leading-tight"
            style={{ color: BG, opacity: 0.6 }}
          >
            {form.bannerSubtitle || ''}
          </p>
          <span
            className="border text-[7px] tracking-widest uppercase px-2 py-0.5"
            style={{ borderColor: ACCENT, color: ACCENT }}
          >
            {form.bannerCtaLabel || 'Explore'}
          </span>
        </div>
      )}

      {/* D) Collections */}
      {hasCollections && (
        <div className="border-t border-gray-100 px-3 py-2">
          <p
            className="text-[7px] tracking-widest uppercase text-center mb-1.5"
            style={{ color: ACCENT }}
          >
            Shop by Collection
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            {form.collectionItems?.slice(0, 5).map(item => (
              <span
                key={item.label}
                className="px-2 py-0.5 text-[7px] tracking-wide uppercase border rounded-full"
                style={{ borderColor: ACCENT, color: DARK }}
              >
                {item.label || '…'}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* E) Testimonials */}
      {hasTestimonials && (
        <div className="border-t border-gray-100 px-3 py-3">
          <p
            className="text-[7px] tracking-widest uppercase text-center mb-2"
            style={{ color: ACCENT }}
          >
            {form.testimonialHeading || 'Reviews'}
          </p>
          {form.testimonials?.slice(0, 2).map((t, i) => (
            <div key={i} className="bg-white rounded p-2 mb-1.5 shadow-sm">
              <p className="text-[7px] font-medium">{t.name}</p>
              <p className="text-[7px] text-gray-400 leading-tight mt-0.5">
                {t.text.slice(0, 60)}{'...'}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminHomepage() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => adminFetch('/api/settings').then(r => r.json()),
  })

  const [form, setForm] = useState<HomepageData>(DEFAULT)

  useEffect(() => {
    if (!settings?.homepage_json) return
    try { setForm(JSON.parse(settings.homepage_json)) } catch { /* ignore */ }
  }, [settings?.homepage_json])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await adminFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homepage_json: JSON.stringify(form) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      showToast('Homepage saved', 'success')
    },
    onError: () => {
      showToast('Failed to save homepage', 'error')
    },
  })

  function addCollectionItem() {
    if ((form.collectionItems?.length ?? 0) >= 8) return
    setForm(f => ({ ...f, collectionItems: [...(f.collectionItems ?? []), { label: '', href: '' }] }))
  }

  function removeCollectionItem(i: number) {
    setForm(f => ({ ...f, collectionItems: (f.collectionItems ?? []).filter((_, idx) => idx !== i) }))
  }

  function updateCollectionItem(i: number, patch: Partial<CollectionItem>) {
    setForm(f => {
      const items = [...(f.collectionItems ?? [])]
      items[i] = { ...items[i], ...patch }
      return { ...f, collectionItems: items }
    })
  }

  function addTestimonial() {
    setForm(f => ({
      ...f,
      testimonials: [...(f.testimonials ?? []), { name: '', location: '', rating: 5, text: '' }],
    }))
  }

  function removeTestimonial(i: number) {
    setForm(f => ({ ...f, testimonials: (f.testimonials ?? []).filter((_, idx) => idx !== i) }))
  }

  function updateTestimonial(i: number, patch: Partial<Testimonial>) {
    setForm(f => {
      const items = [...(f.testimonials ?? [])]
      items[i] = { ...items[i], ...patch }
      return { ...f, testimonials: items }
    })
  }

  if (isLoading) return <p className="text-sm text-gray-400">Loading...</p>

  return (
    <div className="flex gap-8 items-start">
      {/* Form column */}
      <div className="min-w-0 flex-1 space-y-6">
        <h1 className="text-xl font-semibold text-gray-900">Homepage</h1>

        {/* Hero section */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Hero Section</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tagline</label>
            <input
              value={form.heroTagline ?? ''}
              onChange={e => setForm(f => ({ ...f, heroTagline: e.target.value }))}
              placeholder="Discover pieces made to be treasured"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Hero Image URL</label>
            <input
              value={form.heroImage ?? ''}
              onChange={e => setForm(f => ({ ...f, heroImage: e.target.value }))}
              placeholder="https://example.com/hero.jpg"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {/* USP Strip */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">USP Strip</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.uspEnabled ?? true}
              onChange={e => setForm(f => ({ ...f, uspEnabled: e.target.checked }))}
              className="rounded"
            />
            Enable USP Strip
          </label>
        </div>

        {/* Featured Banner */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="font-medium text-gray-800">Featured Banner</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.bannerEnabled ?? true}
              onChange={e => setForm(f => ({ ...f, bannerEnabled: e.target.checked }))}
              className="rounded"
            />
            Enable Featured Banner
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              value={form.bannerTitle ?? ''}
              onChange={e => setForm(f => ({ ...f, bannerTitle: e.target.value }))}
              placeholder="The Gold Edit"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Subtitle</label>
            <input
              value={form.bannerSubtitle ?? ''}
              onChange={e => setForm(f => ({ ...f, bannerSubtitle: e.target.value }))}
              placeholder="Timeless pieces for every occasion"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Image URL</label>
            <input
              value={form.bannerImage ?? ''}
              onChange={e => setForm(f => ({ ...f, bannerImage: e.target.value }))}
              placeholder="https://example.com/banner.jpg"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Link Href</label>
            <LinkPicker
              value={form.bannerHref ?? ''}
              onChange={(href) => setForm(f => ({ ...f, bannerHref: href }))}
              placeholder="/shop"
              inputClassName="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">CTA Label</label>
            <input
              value={form.bannerCtaLabel ?? ''}
              onChange={e => setForm(f => ({ ...f, bannerCtaLabel: e.target.value }))}
              placeholder="Explore the Collection"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
        </div>

        {/* Collections Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-800">Collections Section</h2>
            {(form.collectionItems?.length ?? 0) < 8 && (
              <button
                onClick={addCollectionItem}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                + Add Collection
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.collectionsEnabled ?? true}
              onChange={e => setForm(f => ({ ...f, collectionsEnabled: e.target.checked }))}
              className="rounded"
            />
            Enable Collections Section
          </label>
          <div className="space-y-2">
            {form.collectionItems?.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={item.label}
                  onChange={e => updateCollectionItem(i, { label: e.target.value })}
                  placeholder="Label"
                  className="w-32 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                />
                <LinkPicker
                  value={item.href}
                  onChange={(href, label) => updateCollectionItem(i, { href, ...(label && !item.label ? { label } : {}) })}
                  placeholder="/collections/rings"
                />
                <button
                  onClick={() => removeCollectionItem(i)}
                  className="text-red-400 hover:text-red-600 text-xs shrink-0"
                >
                  ×
                </button>
              </div>
            ))}
            {(form.collectionItems?.length ?? 0) === 0 && (
              <p className="text-sm text-gray-400">No collections yet. Add up to 8.</p>
            )}
          </div>
        </div>

        {/* Testimonials */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-gray-800">Testimonials</h2>
            <button
              onClick={addTestimonial}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              + Add Testimonial
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.testimonialsEnabled ?? true}
              onChange={e => setForm(f => ({ ...f, testimonialsEnabled: e.target.checked }))}
              className="rounded"
            />
            Enable Testimonials
          </label>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Section Heading</label>
            <input
              value={form.testimonialHeading ?? ''}
              onChange={e => setForm(f => ({ ...f, testimonialHeading: e.target.value }))}
              placeholder="What Our Customers Say"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
            />
          </div>
          <div className="space-y-3">
            {form.testimonials?.map((t, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Testimonial {i + 1}</span>
                  <button
                    onClick={() => removeTestimonial(i)}
                    className="text-red-400 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Name</label>
                    <input
                      value={t.name}
                      onChange={e => updateTestimonial(i, { name: e.target.value })}
                      placeholder="Priya S."
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Location</label>
                    <input
                      value={t.location}
                      onChange={e => updateTestimonial(i, { location: e.target.value })}
                      placeholder="Mumbai"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Rating</label>
                    <select
                      value={t.rating}
                      onChange={e => updateTestimonial(i, { rating: Number(e.target.value) })}
                      className="border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500"
                    >
                      {[1, 2, 3, 4, 5].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Review Text</label>
                  <textarea
                    value={t.text}
                    onChange={e => updateTestimonial(i, { text: e.target.value })}
                    placeholder="Absolutely beautiful craftsmanship..."
                    rows={2}
                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500 resize-none"
                  />
                </div>
              </div>
            ))}
            {(form.testimonials?.length ?? 0) === 0 && (
              <p className="text-sm text-gray-400">No testimonials yet.</p>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-6 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Homepage'}
          </button>
        </div>
      </div>

      {/* Preview column */}
      <div className="w-72 shrink-0 sticky top-6">
        <p className="text-sm font-medium text-gray-700 mb-1">Preview</p>
        <p className="text-xs text-gray-400 mb-3">Updates as you type</p>
        <HomepagePreview form={form} />
      </div>
    </div>
  )
}
