import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ImageUploader from '../ImageUploader'
import { adminFetch } from '../lib/adminFetch'
import { SkeletonTable } from '../../components/Skeleton'

interface BlogPostSummary {
  id: number
  slug: string
  title: string
  author: string
  published_at: string | null
  created_at: string
}

interface BlogPostFull extends BlogPostSummary {
  content_html: string
  cover_image: string
  tags: string
  seo_title: string
  seo_description: string
}

type ModalMode = 'create' | 'edit' | null

const emptyForm = {
  slug: '',
  title: '',
  content_html: '',
  cover_image: '',
  author: '',
  tags: '',
  published_at: '',
  seo_title: '',
  seo_description: '',
}

export default function AdminBlog() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<BlogPostSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<{ posts: BlogPostSummary[] }>({
    queryKey: ['admin-blog'],
    queryFn: () =>
      adminFetch('/api/admin/blog').then(r => {
        if (!r.ok) throw new Error('Failed to load posts')
        return r.json() as Promise<{ posts: BlogPostSummary[] }>
      }),
  })

  const { data: fullPost } = useQuery<BlogPostFull>({
    queryKey: ['admin-blog-post', editing?.id],
    queryFn: () =>
      adminFetch(`/api/admin/blog/${editing!.id}`).then(r => {
        if (!r.ok) throw new Error('Failed to load post')
        return r.json() as Promise<BlogPostFull>
      }),
    enabled: !!editing,
  })

  // Fix 1: also sync slug and author from the full post response
  useEffect(() => {
    if (fullPost && fullPost.id === editing?.id) {
      setForm(f => ({
        ...f,
        slug: fullPost.slug,
        author: fullPost.author ?? '',
        content_html: fullPost.content_html ?? '',
        cover_image: fullPost.cover_image ?? '',
        tags: fullPost.tags ?? '',
        seo_title: fullPost.seo_title ?? '',
        seo_description: fullPost.seo_description ?? '',
      }))
    }
  }, [fullPost, editing?.id])

  const saveMutation = useMutation({
    mutationFn: async (body: typeof emptyForm) => {
      const payload = {
        ...body,
        published_at: body.published_at ? new Date(body.published_at).toISOString() : null,
      }
      if (editing) {
        const res = await adminFetch(`/api/admin/blog/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to save')
      } else {
        const res = await adminFetch('/api/admin/blog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] })
      if (editing) qc.invalidateQueries({ queryKey: ['admin-blog-post', editing.id] })
      setModal(null)
      setEditing(null)
      setForm(emptyForm)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      adminFetch(`/api/admin/blog/${id}`, { method: 'DELETE' }).then(r => {
        if (!r.ok) throw new Error('Delete failed')
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] })
      setDeleteId(null)
    },
  })

  // Fix 3: reset saveMutation error state when opening the create modal
  function openCreate() {
    saveMutation.reset()
    setEditing(null)
    setForm(emptyForm)
    setModal('create')
  }

  // Fix 2 + Fix 3: use local-time formatting for datetime-local input and reset mutation
  function openEdit(post: BlogPostSummary) {
    saveMutation.reset()
    setEditing(post)
    setForm({
      slug: post.slug,
      title: post.title,
      author: post.author ?? '',
      content_html: '',
      cover_image: '',
      tags: '',
      published_at: post.published_at
        ? (() => {
            const d = new Date(post.published_at)
            const pad = (n: number) => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          })()
        : '',
      seo_title: '',
      seo_description: '',
    })
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setForm(emptyForm)
    setDeleteId(null)
  }

  if (isLoading) return <SkeletonTable rows={8} cols={4} />

  const posts = data?.posts ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Blog Posts</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded hover:bg-gray-700"
        >
          New Post
        </button>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Author</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No blog posts yet. Create your first post.
                </td>
              </tr>
            )}
            {posts.map(post => (
              <tr key={post.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{post.title}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{post.slug}</td>
                <td className="px-4 py-3 text-gray-500">{post.author || '—'}</td>
                <td className="px-4 py-3">
                  {post.published_at ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      Published &middot;{' '}
                      {new Date(post.published_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => openEdit(post)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  {deleteId === post.id ? (
                    <span className="text-xs">
                      <button
                        onClick={() => deleteMutation.mutate(post.id)}
                        className="text-red-600 hover:text-red-800 mr-1"
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
                      onClick={() => setDeleteId(post.id)}
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

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {modal === 'create' ? 'New Blog Post' : 'Edit Blog Post'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                saveMutation.mutate(form)
              }}
              className="px-6 py-4 space-y-4"
            >
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Slug *</label>
                <input
                  required
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono"
                  placeholder="my-post-title"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Author</label>
                <input
                  value={form.author}
                  onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              {/* Publish Date */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Publish Date{' '}
                  <span className="text-gray-400 font-normal">(leave empty to save as draft)</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.published_at}
                  onChange={e => setForm(f => ({ ...f, published_at: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>

              {/* Cover Image */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cover Image</label>
                <ImageUploader
                  existingUrl={form.cover_image}
                  onUploadComplete={url => setForm(f => ({ ...f, cover_image: url }))}
                />
              </div>

              {/* Content HTML */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Content (HTML)</label>
                <textarea
                  rows={12}
                  value={form.content_html}
                  onChange={e => setForm(f => ({ ...f, content_html: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-mono text-xs"
                  placeholder="<p>Post content here…</p>"
                />
              </div>

              {/* SEO Title */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SEO Title</label>
                <input
                  value={form.seo_title}
                  onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>

              {/* SEO Description */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">SEO Description</label>
                <input
                  value={form.seo_description}
                  onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
              </div>

              {saveMutation.isError && (
                <p className="text-red-600 text-xs">Failed to save. Please try again.</p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
