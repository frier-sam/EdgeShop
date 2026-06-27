import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminFetch } from './lib/adminFetch'

interface LinkPickerProps {
  value: string
  onChange: (href: string, label?: string) => void
  placeholder?: string
  inputClassName?: string
}

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Shop', href: '/shop' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
  { label: 'Search', href: '/search' },
]

type Tab = 'collection' | 'page' | 'quick'

export default function LinkPicker({ value, onChange, placeholder = '/collections/rings', inputClassName }: LinkPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('collection')
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: collectionsData } = useQuery<{ collections: Array<{ id: number; name: string; slug: string; depth: number }> }>({
    queryKey: ['admin-collections'],
    queryFn: () => adminFetch('/api/admin/collections').then(r => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  const { data: pagesData } = useQuery<{ pages: Array<{ id: number; title: string; slug: string }> }>({
    queryKey: ['admin-pages'],
    queryFn: () => adminFetch('/api/admin/pages').then(r => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputClassName ?? 'flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-gray-500'}
        />
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="Pick a link"
          className={`shrink-0 px-2 py-1.5 border rounded text-xs transition-colors ${
            open
              ? 'border-gray-900 bg-gray-900 text-white'
              : 'border-gray-300 text-gray-500 hover:border-gray-500 hover:text-gray-800'
          }`}
        >
          ↗
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {(['collection', 'page', 'quick'] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                  tab === t
                    ? 'text-gray-900 border-b-2 border-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'quick' ? 'Quick Links' : t}
              </button>
            ))}
          </div>

          <div className="p-3">
            {tab === 'collection' && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {!collectionsData && (
                  <p className="text-xs text-gray-400 py-2 text-center">Loading…</p>
                )}
                {collectionsData?.collections.length === 0 && (
                  <div className="py-2 text-center">
                    <p className="text-xs text-gray-400">No collections yet.</p>
                    <p className="text-xs text-gray-300 mt-0.5">You can still type a URL directly in the input.</p>
                  </div>
                )}
                {collectionsData?.collections.map(c => {
                  const href = `/collections/${c.slug}`
                  const isActive = value === href
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { onChange(href, c.name); setOpen(false) }}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                        isActive ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className={isActive ? 'text-gray-400' : 'text-gray-300'}>{'— '.repeat(c.depth)}</span>
                      {c.name}
                      <span className={`ml-1 ${isActive ? 'text-gray-400' : 'text-gray-400'}`}>{href}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {tab === 'page' && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {!pagesData && (
                  <p className="text-xs text-gray-400 py-2 text-center">Loading…</p>
                )}
                {pagesData?.pages.length === 0 && (
                  <p className="text-xs text-gray-400 py-2 text-center">No pages yet.</p>
                )}
                {pagesData?.pages.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onChange(`/pages/${p.slug}`, p.title); setOpen(false) }}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 text-gray-700 transition-colors"
                  >
                    {p.title}
                    <span className="text-gray-400 ml-1">/pages/{p.slug}</span>
                  </button>
                ))}
              </div>
            )}

            {tab === 'quick' && (
              <div className="flex flex-wrap gap-1.5">
                {QUICK_LINKS.map(q => (
                  <button
                    key={q.href}
                    type="button"
                    onClick={() => { onChange(q.href, q.label); setOpen(false) }}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-full text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
