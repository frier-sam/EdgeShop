import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { NavItem } from '../../themes/types'
import { showToast } from '../Toast'
import { adminFetch } from '../lib/adminFetch'
import LinkPicker from '../LinkPicker'

type ModalState =
  | { mode: 'add-top' }
  | { mode: 'add-child'; parentIndex: number }
  | { mode: 'edit-top'; itemIndex: number }
  | { mode: 'edit-child'; parentIndex: number; childIndex: number }

export default function AdminNavigation() {
  const qc = useQueryClient()

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => adminFetch('/api/settings').then(r => r.json()),
  })

  const { data: collectionsData } = useQuery<{ collections: Array<{ id: number; name: string; slug: string; depth: number }> }>({
    queryKey: ['admin-collections'],
    queryFn: () => adminFetch('/api/admin/collections').then(r => r.json()),
  })

  const { data: pagesData } = useQuery<{ pages: Array<{ id: number; title: string; slug: string }> }>({
    queryKey: ['admin-pages'],
    queryFn: () => adminFetch('/api/admin/pages').then(r => r.json()),
  })

  const [items, setItems] = useState<NavItem[]>([])
  const [modal, setModal] = useState<ModalState | null>(null)
  const [itemType, setItemType] = useState<'link' | 'collection' | 'page'>('link')
  const [editLabel, setEditLabel] = useState('')
  const [editHref, setEditHref] = useState('')

  useEffect(() => {
    if (!settings?.navigation_json) return
    try { setItems(JSON.parse(settings.navigation_json)) } catch { setItems([]) }
  }, [settings?.navigation_json])

  const saveMutation = useMutation({
    mutationFn: async (newItems: NavItem[]) => {
      const res = await adminFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigation_json: JSON.stringify(newItems) }),
      })
      if (!res.ok) throw new Error('Failed to save')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      showToast('Navigation saved', 'success')
    },
    onError: () => {
      showToast('Failed to save navigation', 'error')
    },
  })

  function save(newItems: NavItem[]) {
    setItems(newItems)
    saveMutation.mutate(newItems)
  }

  function openAdd(parentIndex?: number) {
    setModal(parentIndex !== undefined ? { mode: 'add-child', parentIndex } : { mode: 'add-top' })
    setItemType('link')
    setEditLabel('')
    setEditHref('')
  }

  function openEdit(itemIndex: number): void
  function openEdit(parentIndex: number, childIndex: number): void
  function openEdit(a: number, b?: number) {
    if (b !== undefined) {
      const child = items[a]?.children?.[b]
      if (!child) return
      setModal({ mode: 'edit-child', parentIndex: a, childIndex: b })
      setItemType((child.type as 'link' | 'collection' | 'page') ?? 'link')
      setEditLabel(child.label)
      setEditHref(child.href)
    } else {
      const item = items[a]
      if (!item) return
      setModal({ mode: 'edit-top', itemIndex: a })
      setItemType((item.type as 'link' | 'collection' | 'page') ?? 'link')
      setEditLabel(item.label)
      setEditHref(item.href)
    }
  }

  function handleTypeSelect(type: 'link' | 'collection' | 'page') {
    setItemType(type)
    setEditLabel('')
    setEditHref('')
  }

  function handleCollectionSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const col = collectionsData?.collections.find(c => c.slug === e.target.value)
    if (col) { setEditLabel(col.name); setEditHref(`/collections/${col.slug}`) }
  }

  function handlePageSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const page = pagesData?.pages.find(p => p.slug === e.target.value)
    if (page) { setEditLabel(page.title); setEditHref(`/pages/${page.slug}`) }
  }

  function commit() {
    const label = editLabel.trim()
    const href = editHref.trim()
    if (!label || !href || !modal) return

    let updated: NavItem[]

    if (modal.mode === 'add-top') {
      updated = [...items, { label, href, type: itemType }]
    } else if (modal.mode === 'add-child') {
      updated = items.map((item, i) =>
        i === modal.parentIndex
          ? { ...item, children: [...(item.children ?? []), { label, href, type: itemType }] }
          : item
      )
    } else if (modal.mode === 'edit-top') {
      updated = items.map((item, i) =>
        i === modal.itemIndex ? { ...item, label, href, type: itemType } : item
      )
    } else {
      // edit-child
      updated = items.map((item, i) =>
        i === modal.parentIndex
          ? {
              ...item,
              children: item.children?.map((child, ci) =>
                ci === modal.childIndex ? { ...child, label, href, type: itemType } : child
              ),
            }
          : item
      )
    }

    save(updated)
    setModal(null)
  }

  function removeItem(index: number) {
    save(items.filter((_, i) => i !== index))
  }

  function removeChild(parentIndex: number, childIndex: number) {
    save(items.map((item, i) =>
      i === parentIndex
        ? { ...item, children: item.children?.filter((_, ci) => ci !== childIndex) }
        : item
    ))
  }

  function moveItem(index: number, dir: 'up' | 'down') {
    const updated = [...items]
    const target = dir === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= updated.length) return
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    save(updated)
  }

  const isEditing = modal?.mode === 'edit-top' || modal?.mode === 'edit-child'

  const modalTitle = !modal ? '' :
    modal.mode === 'add-top' ? 'Add Navigation Item' :
    modal.mode === 'add-child' ? `Add sub-item under "${items[modal.parentIndex]?.label}"` :
    modal.mode === 'edit-top' ? `Edit "${items[modal.itemIndex]?.label}"` :
    `Edit sub-item`

  if (isLoading) return <p className="text-sm text-gray-400">Loading…</p>

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Navigation Menu</h1>
        <button
          onClick={() => openAdd()}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          + Add Item
        </button>
      </div>
      <p className="text-sm text-gray-500">Build your storefront navigation. Items can have one level of sub-items.</p>

      {/* Item list */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
        {items.length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No nav items yet. Add your first item.</p>
        )}
        {items.map((item, i) => (
          <div key={i}>
            {/* Parent item */}
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-400 truncate">{item.href}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(i)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-800 border border-gray-200 rounded hover:border-gray-400 transition-colors">Edit</button>
                <button onClick={() => openAdd(i)} className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 border border-gray-200 rounded" title="Add sub-item">+ Sub</button>
                <button onClick={() => moveItem(i, 'up')} disabled={i === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">↑</button>
                <button onClick={() => moveItem(i, 'down')} disabled={i === items.length - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">↓</button>
                <button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600">×</button>
              </div>
            </div>
            {/* Children */}
            {item.children?.map((child, ci) => (
              <div key={ci} className="flex items-center gap-3 pl-8 pr-4 py-2 bg-gray-50 border-t border-gray-100">
                <div className="w-2 h-px bg-gray-300 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{child.label}</p>
                  <p className="text-xs text-gray-400 truncate">{child.href}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(i, ci)} className="text-xs px-2 py-1 text-gray-500 hover:text-gray-800 border border-gray-200 rounded hover:border-gray-400 transition-colors">Edit</button>
                  <button onClick={() => removeChild(i, ci)} className="p-1 text-red-400 hover:text-red-600">×</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">{modalTitle}</h2>

            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {(['collection', 'page', 'link'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => handleTypeSelect(t)}
                  className={`py-2 text-xs rounded-lg border-2 font-medium capitalize transition-colors ${
                    itemType === t ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {t === 'link' ? 'Custom Link' : t}
                </button>
              ))}
            </div>

            {/* Quick links */}
            {itemType === 'link' && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Quick fill</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Shop', href: '/shop' },
                    { label: 'Home', href: '/' },
                    { label: 'Blog', href: '/blog' },
                    { label: 'Contact', href: '/contact' },
                  ].map(q => (
                    <button
                      key={q.href}
                      type="button"
                      onClick={() => { setEditLabel(q.label); setEditHref(q.href) }}
                      className="px-2.5 py-1 text-xs border border-gray-200 rounded-full text-gray-500 hover:border-gray-400 hover:text-gray-800 transition-colors"
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Collection / Page selectors */}
            {itemType === 'collection' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Collection</label>
                <select onChange={handleCollectionSelect} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a collection…</option>
                  {collectionsData?.collections.map(c => (
                    <option key={c.id} value={c.slug}>
                      {'—'.repeat(c.depth)}{c.depth > 0 ? ' ' : ''}{c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {itemType === 'page' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Page</label>
                <select onChange={handlePageSelect} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a page…</option>
                  {pagesData?.pages.map(p => (
                    <option key={p.id} value={p.slug}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Label</label>
              <input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="About Us"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL</label>
              <LinkPicker
                value={editHref}
                onChange={(href, label) => { setEditHref(href); if (label && !editLabel) setEditLabel(label) }}
                placeholder="/pages/about-us"
                inputClassName="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={commit}
                disabled={!editLabel.trim() || !editHref.trim()}
                className="flex-1 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
              >
                {isEditing ? 'Save Changes' : 'Add'}
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 border border-gray-300 text-sm rounded hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
