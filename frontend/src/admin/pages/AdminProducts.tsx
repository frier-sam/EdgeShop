import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { SkeletonTable } from '../../components/Skeleton'
import Button from '../../components/Button'
import Field from '../../components/Field'
import Badge from '../../components/ui/Badge'

interface AdminProductRow {
  id: number
  name: string
  slug: string | null
  base_price: number
  compare_price: number | null
  category: string
  status: 'active' | 'draft'
  is_customizable: number
  stock_count: number
  front_image: string | null
}

function Thumb({ p }: { p: AdminProductRow }) {
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-btn bg-surface-2">
      {p.front_image && <img src={p.front_image} alt={p.name} className="h-full w-full object-cover" />}
    </div>
  )
}

export default function AdminProducts() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery<{ products: AdminProductRow[]; total: number; page: number; pages: number }>({
    queryKey: ['admin-products', q, statusFilter, page],
    queryFn: () =>
      adminFetch('/api/admin/products?' + new URLSearchParams({
        ...(q && { q }),
        ...(statusFilter && { status: statusFilter }),
        page: String(page),
      })).then((r) => r.json()),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/products/${id}`, { method: 'DELETE' }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products'] }); setDeleteId(null) },
  })

  const products = data?.products ?? []
  const totalPages = data?.pages ?? 1
  const totalProducts = data?.total ?? 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">Products</h1>
        <Button variant="primary" onClick={() => navigate('/admin/products/new')}>
          + Add product
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Field
          label="Search"
          containerClassName="min-w-40 flex-1"
          type="search"
          placeholder="Search products…"
          value={q}
          onChange={e => { setQ(e.target.value); setPage(1) }}
        />
        <Field
          label="Status"
          as="select"
          containerClassName="w-40"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'draft', label: 'Draft' },
          ]}
        />
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : products.length === 0 ? (
        <div className="rounded-card border border-line bg-surface py-16 text-center text-ink-faint">
          <p className="mb-3">No products yet</p>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/products/new')}>
            Add your first product
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="space-y-3 md:hidden">
            {products.map((p) => (
              <div key={p.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex gap-3">
                  <Thumb p={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{p.name}</p>
                    <p className="mt-0.5 text-sm text-ink-soft">₹{p.base_price.toFixed(2)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant={p.status === 'active' ? 'success' : 'neutral'} size="sm">{p.status}</Badge>
                      {!!p.is_customizable && <Badge variant="accent" size="sm">Customizable</Badge>}
                      <span className="text-xs text-ink-faint">Stock {p.stock_count}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 border-t border-line pt-3">
                  <Button as={Link} to={`/admin/products/${p.id}`} variant="secondary" size="sm" fullWidth>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" fullWidth onClick={() => setDeleteId(p.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-card border border-line bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-line bg-surface-2">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-ink-soft">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-ink-soft">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {products.map((p) => (
                  <tr key={p.id} className="transition-colors duration-fast hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <Thumb p={p} />
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {p.name}
                      {!!p.is_customizable && (
                        <Badge variant="accent" size="sm" className="ml-2 align-middle">Customizable</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">₹{p.base_price.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === 'active' ? 'success' : 'neutral'} size="sm">{p.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{p.stock_count}</td>
                    <td className="px-4 py-3 text-right">
                      <Link to={`/admin/products/${p.id}`} className="mr-4 text-xs font-medium text-accent hover:text-accent-dark">Edit</Link>
                      <button onClick={() => setDeleteId(p.id)} className="text-xs font-medium text-danger hover:text-danger/80">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-ink-soft">
          <span>{totalProducts} product{totalProducts !== 1 ? 's' : ''} — page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
              ← Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <>
          <div className="fixed inset-0 z-40 animate-fade-in bg-ink/40" onClick={() => setDeleteId(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="w-full max-w-sm animate-scale-in rounded-card bg-surface p-6 shadow-lift">
              <h3 className="mb-2 font-display font-semibold text-ink">Delete product?</h3>
              <p className="mb-6 text-sm text-ink-soft">This action cannot be undone.</p>
              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={() => setDeleteId(null)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  loading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(deleteId)}
                >
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
