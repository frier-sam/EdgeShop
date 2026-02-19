import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from '../themes/ThemeProvider'

interface PageData {
  title: string
  content_html: string
  meta_title: string
  meta_description: string
}

export default function StaticPage() {
  const { slug } = useParams<{ slug: string }>()
  const { theme, settings, isLoading: isThemeLoading, navItems } = useTheme()

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['page', slug],
    queryFn: () => fetch(`/api/pages/${slug}`).then(r => {
      if (!r.ok) throw new Error('Not found')
      return r.json() as Promise<PageData>
    }),
    enabled: !!slug,
  })

  const storeName = settings.store_name ?? 'EdgeShop'

  useEffect(() => {
    if (!page) return
    document.title = page.meta_title || page.title
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', page.meta_description || '')
  }, [page])

  if (isThemeLoading || isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Loading…</p>
    </div>
  )
  if (error || !page) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Page not found.</p>
    </div>
  )
  if (!theme) return null

  const { Header, Footer } = theme.components

  return (
    <div>
      <Header storeName={storeName} cartCount={0} onCartOpen={() => {}} navItems={navItems} />
      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">{page.title}</h1>
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: page.content_html }}
        />
      </main>
      <Footer storeName={storeName} />
    </div>
  )
}
