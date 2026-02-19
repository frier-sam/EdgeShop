import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

interface BlogPost {
  id: number
  slug: string
  title: string
  content_html: string
  cover_image: string
  author: string
  tags: string
  published_at: string | null
  seo_title: string
  seo_description: string
}

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const { theme, isLoading: themeLoading, navItems, settings } = useTheme()
  const totalItems = useCartStore((s) => s.totalItems)

  const storeName = settings.store_name ?? 'EdgeShop'

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ['blog-post', slug],
    queryFn: () => fetch(`/api/blog/${slug}`).then(r => {
      if (!r.ok) throw new Error('Not found')
      return r.json()
    }),
    enabled: !!slug,
  })

  useEffect(() => {
    if (!post) return
    document.title = post.seo_title || post.title
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', post.seo_description || '')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
    }
  }, [post])

  if (themeLoading || !theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    )
  }

  const { Header, Footer } = theme.components

  return (
    <div className="min-h-screen">
      <Header
        storeName={storeName}
        cartCount={totalItems()}
        onCartOpen={() => {}}
        navItems={navItems}
      />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/blog" className="text-sm text-gray-500 hover:text-gray-800 mb-6 inline-block">← Back to Blog</Link>
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
        {isError && <p className="text-sm text-red-500">Post not found.</p>}
        {post && (
          <>
            {post.cover_image && (
              <img src={post.cover_image} alt={post.title} className="w-full h-64 object-cover rounded-lg mb-8" />
            )}
            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-2">
                {post.published_at
                  ? new Date(post.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
                  : 'Draft'}
                {post.author && ` · ${post.author}`}
              </p>
              <h1 className="text-3xl font-bold text-gray-900">{post.title}</h1>
            </div>
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: post.content_html }}
            />
            {post.tags && (
              <div className="mt-8 flex flex-wrap gap-2">
                {post.tags.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (
                  <span key={tag} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{tag}</span>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <Footer storeName={storeName} />
    </div>
  )
}
