import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { AlertCircle, ArrowLeft, Loader2, CalendarDays } from 'lucide-react'
import { useContent } from '../context/ContentContext'

const normalizeTitle = (title, fallback) => {
  if (!title) return fallback
  if (typeof title === 'string') return title
  if (Array.isArray(title)) {
    return title.filter(Boolean).join(' ')
  }
  if (typeof title === 'object') {
    const values = Object.values(title).filter((part) => typeof part === 'string' && part.trim())
    if (values.length) {
      return values.join(' ')
    }
  }
  return fallback
}

const normalizeText = (value, fallback = '') => {
  if (!value) return fallback
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.filter((part) => typeof part === 'string').join('\n')
  }
  if (typeof value === 'object') {
    if (value.text && typeof value.text === 'string') {
      return value.text
    }
    const values = Object.values(value).filter((part) => typeof part === 'string')
    if (values.length) {
      return values.join('\n')
    }
  }
  return fallback
}

const formatDate = (isoString) => {
  if (!isoString) return null
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const DynamicPage = () => {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const { pages } = useContent()

  const normalizedSlug = useMemo(() => slug.trim().toLowerCase(), [slug])

  const cachedPage = pages.cache?.[normalizedSlug]
  const [pageData, setPageData] = useState(cachedPage ?? null)
  const [loading, setLoading] = useState(!cachedPage)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!normalizedSlug) {
      setError(new Error('Ungültige Seite'))
      setLoading(false)
      return
    }

    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await pages.fetch(normalizedSlug, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setPageData(data)
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }
        setError(err)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      controller.abort()
    }
  }, [normalizedSlug, pages])

  const page = pageData?.page
  const posts = Array.isArray(pageData?.posts) ? pageData.posts : []
  const hero = page?.hero ?? {}

  const heroTitle = normalizeTitle(hero.title, page?.title)
  const heroSubtitle = normalizeText(hero.subtitle ?? hero.description, page?.description)
  const heroBadge = normalizeText(hero.badge ?? hero.badgeText, null)
  const heroGradient = hero.backgroundGradient || hero.gradient || 'from-primary-600 to-primary-700'

  const hasContent = Boolean(page)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          className="group inline-flex items-center gap-2 text-primary-700 font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Zurück
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Seite wird geladen…</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Seite konnte nicht geladen werden</h2>
              <p className="text-sm">{error?.message || 'Unbekannter Fehler'}</p>
            </div>
          </div>
        ) : !hasContent ? (
          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
            Die angeforderte Seite wurde nicht gefunden oder ist nicht veröffentlicht.
          </div>
        ) : (
          <div className="space-y-12">
            <section className="relative overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-xl">
              <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient} opacity-90`} aria-hidden="true" />
              <div className="relative px-6 py-12 sm:px-10 sm:py-14 text-white">
                <div className="max-w-3xl space-y-6">
                  {heroBadge && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
                      {heroBadge}
                    </span>
                  )}
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight drop-shadow-sm">
                    {heroTitle || 'Neue Seite'}
                  </h1>
                  {heroSubtitle && <p className="text-lg text-white/90 leading-relaxed">{heroSubtitle}</p>}
                </div>
              </div>
            </section>

            {page?.description && (
              <section className="bg-white rounded-3xl shadow-lg border border-gray-100 px-6 py-8 sm:px-10">
                <h2 className="text-2xl font-semibold text-gray-900 mb-3">Über diese Seite</h2>
                <p className="text-gray-700 leading-relaxed">{page.description}</p>
              </section>
            )}

            <section className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-gray-900">
                  {posts.length > 0 ? 'Beiträge' : 'Keine Beiträge vorhanden'}
                </h2>
                {posts.length > 0 && (
                  <span className="text-sm text-gray-500">{posts.length} veröffentlichte Beitrag{posts.length === 1 ? '' : 'e'}</span>
                )}
              </div>

              {posts.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">
                  Sobald für diese Seite Beiträge veröffentlicht werden, erscheinen sie hier.
                </div>
              ) : (
                <div className="space-y-10">
                  {posts.map((post) => {
                    const publishedDate = formatDate(post.published_at)
                    const excerpt = normalizeText(post.excerpt)

                    return (
                      <article
                        key={post.id}
                        className="rounded-3xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="px-6 py-7 sm:px-9 sm:py-8 space-y-6">
                          <header className="space-y-2">
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                              {publishedDate && (
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays className="w-4 h-4" />
                                  {publishedDate}
                                </span>
                              )}
                            </div>
                            <h3 className="text-2xl font-semibold text-gray-900">{post.title}</h3>
                            {excerpt && <p className="text-gray-600 leading-relaxed">{excerpt}</p>}
                          </header>

                          <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-primary-600">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                              {post.content_markdown || 'Kein Inhalt verfügbar.'}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

export default DynamicPage
