import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'
import { useCartStore } from '../store/cartStore'

interface BlogPost {
  id: number
  slug: string
  title: string
  cover_image: string
  author: string
  tags: string
  published_at: string | null
  seo_title: string
  seo_description: string
}

export default function BlogListPage() {
  const { theme, isLoading: themeLoading, navItems, settings } = useTheme()
  const totalItems = useCartStore((s) => s.totalItems)

  const storeName = settings.store_name ?? 'EdgeShop'

  const { data, isLoading, isError } = useQuery<{ posts: BlogPost[] }>({
    queryKey: ['blog-posts'],
    queryFn: () => fetch('/api/blog').then(r => {
      if (!r.ok) throw new Error('Failed to load posts')
      return r.json()
    }),
  })

  const posts = data?.posts ?? []

  useEffect(() => {
    document.title = 'Blog'
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', 'Latest articles and updates')
    return () => {
      document.title = ''
      const m = document.querySelector('meta[name="description"]')
      if (m) m.setAttribute('content', '')
    }
  }, [])

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
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-8">Blog</h1>
        {isLoading && <p className="text-sm text-gray-400">Loading...</p>}
        {isError && <p className="text-sm text-red-500">Failed to load posts.</p>}
        {!isLoading && !isError && posts.length === 0 && (
          <p className="text-gray-400 text-sm">No posts yet.</p>
        )}
        {posts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group block border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {post.cover_image ? (
                  <img src={post.cover_image} alt={post.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-300 text-sm">No image</div>
                )}
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-1">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Draft'}
                    {post.author && ` · ${post.author}`}
                  </p>
                  <h2 className="font-semibold text-gray-900 group-hover:text-gray-600 transition-colors line-clamp-2">{post.title}</h2>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer storeName={storeName} />
    </div>
  )
}
