import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminFetch } from '../lib/adminFetch'
import { SkeletonTable } from '../../components/Skeleton'

interface Review {
  id: number
  product_id: number
  customer_name: string
  rating: number
  body: string
  is_approved: number  // 0 = pending, 1 = approved
  created_at: string
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function truncate(text: string, max = 100): string {
  if (text.length <= max) return text
  return text.slice(0, max) + '…'
}

function Stars({ rating }: { rating: number }) {
  return <span className="text-yellow-400 tracking-tight">{'★'.repeat(rating)}</span>
}

export default function AdminReviews() {
  const qc = useQueryClient()

  const [tab, setTab] = useState<'pending' | 'approved'>('pending')
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<{ reviews: Review[] }>({
    queryKey: ['admin-reviews', tab],
    queryFn: () =>
      adminFetch(`/api/admin/reviews?status=${tab}`).then(r => {
        if (!r.ok) throw new Error('Failed to load reviews')
        return r.json()
      }),
  })

  const approveMutation = useMutation({
    mutationFn: ({ id, is_approved }: { id: number; is_approved: boolean }) =>
      adminFetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved }),
      }).then(r => {
        if (!r.ok) throw new Error('Failed to update')
        return r.json()
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reviews'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/reviews/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] })
      setDeleteId(null)
    },
  })

  const reviews = data?.reviews ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'approved'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setDeleteId(null) }}
            className={`px-4 py-2 text-sm rounded border ${
              tab === t
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Customer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Rating</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Review</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reviews.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No {tab} reviews.
                </td>
              </tr>
            )}
            {reviews.map(review => (
              <tr key={review.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                  {review.customer_name}
                </td>
                <td className="px-4 py-3">
                  <Stars rating={review.rating} />
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs">
                  {truncate(review.body)}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  #{review.product_id}
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {formatDate(review.created_at)}
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                  {tab === 'pending' ? (
                    <button
                      onClick={() => approveMutation.mutate({ id: review.id, is_approved: true })}
                      disabled={approveMutation.isPending}
                      className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50"
                    >
                      Approve
                    </button>
                  ) : (
                    <button
                      onClick={() => approveMutation.mutate({ id: review.id, is_approved: false })}
                      disabled={approveMutation.isPending}
                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  )}
                  {deleteId === review.id ? (
                    <span className="text-xs">
                      <button
                        onClick={() => deleteMutation.mutate(review.id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-600 hover:text-red-800 mr-1 disabled:opacity-50"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteId(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeleteId(review.id)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
