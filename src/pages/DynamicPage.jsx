import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, CalendarDays } from 'lucide-react'
import { useContent } from '../context/ContentContext' // Content management context
import {
  normalizeTitle,
  normalizeText,
  buildPreviewText,
  formatDate,
  normalizeSlug,
} from '../utils/postUtils'
const DynamicPage = () => {
  const { slug = '' } = useParams()              // Get page slug from URL parameters
  const navigate = useNavigate()
  const { pages } = useContent()
  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug])
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
  const layout = page?.layout ?? {}
  const aboutSection = layout?.aboutSection ?? {}
  const postsSection = layout?.postsSection ?? {}
  const heroTitle = normalizeTitle(hero.title, page?.title)
  const heroSubtitle = normalizeText(hero.subtitle ?? hero.description, page?.description)
  const heroBadge = normalizeText(hero.badge ?? hero.badgeText, null)
  const heroGradient = hero.backgroundGradient || hero.gradient || 'from-primary-600 to-primary-700'
  const aboutTitle = normalizeText(aboutSection.title, 'Über diese Seite')
  const postsTitle = normalizeText(postsSection.title, 'Beiträge')
  const postsEmptyTitle = normalizeText(postsSection.emptyTitle, 'Keine Beiträge vorhanden')
  const postsEmptyMessage = normalizeText(
    postsSection.emptyMessage,
    'Sobald für diese Seite Beiträge veröffentlicht werden, erscheinen sie hier.',
  )
  const postsCountSingular = normalizeText(
    postsSection.countLabelSingular,
    '{count} veröffentlichter Beitrag',
  )
  const postsCountPlural = normalizeText(
    postsSection.countLabelPlural,
    '{count} veröffentlichte Beiträge',
  )
  const formatPostsCount = (count) => {
    const template = count === 1 ? postsCountSingular : postsCountPlural
    if (typeof template === 'string' && template.includes('{count}')) {
      return template.replace('{count}', count)
    }
    if (template && typeof template === 'string') {
      return template
    }
    return count === 1
      ? `${count} veröffentlichter Beitrag`
      : `${count} veröffentlichte Beiträge`
  }
  const hasContent = Boolean(page)
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {}
        {}
        <button
          onClick={() => navigate('/', { state: { scrollTo: null, from: 'dynamic-page' } })}
          className="group inline-flex items-center gap-2 text-primary-700 font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Zurück
        </button>
        {}
        {}
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
            {}
            {}
            <section className="relative overflow-hidden rounded-3xl border border-primary-100 dark:border-primary-900/40 bg-white dark:bg-slate-900/80 shadow-xl">
              {}
              <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient} opacity-90`} aria-hidden="true" />
              {}
              <div className="relative px-6 py-12 sm:px-10 sm:py-14 text-white">
                <div className="max-w-3xl space-y-6">
                  {}
                  {heroBadge && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
                      {heroBadge}
                    </span>
                  )}
                  {}
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight drop-shadow-sm">
                    {heroTitle || 'Neue Seite'}
                  </h1>
                  {}
                  {heroSubtitle && <p className="text-lg text-white/90 leading-relaxed">{heroSubtitle}</p>}
                </div>
              </div>
            </section>
            {}
            {}
            {page?.description && (
              <section className="bg-white dark:bg-slate-900/80 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 px-6 py-8 sm:px-10">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-3">{aboutTitle}</h2>
                <p className="text-gray-700 dark:text-slate-200 leading-relaxed">{page.description}</p>
              </section>
            )}
            {}
            <section className="space-y-6">
              {}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  {posts.length > 0 ? postsTitle : postsEmptyTitle}
                </h2>
                {}
                {posts.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-slate-400">{formatPostsCount(posts.length)}</span>
                )}
              </div>
              {}
              {}
              {posts.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 text-center text-gray-600 dark:text-slate-300">
                  {postsEmptyMessage}
                </div>
              ) : (
                <div className="space-y-10">
                  {posts.map((post) => {
                    const publishedDate = formatDate(post.published_at)
                    const previewText = buildPreviewText(post)
                    const postSlug = normalizeSlug(post?.slug)
                    return (
                      <article
                        key={post.id}
                        className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="px-6 py-7 sm:px-9 sm:py-8 space-y-6">
                          {}
                          <header className="space-y-2">
                            {}
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                              {publishedDate && (
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays className="w-4 h-4" />
                                  {publishedDate}
                                </span>
                              )}
                            </div>
                            {}
                            <h3 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 break-words">{post.title}</h3>
                            {}
                            {previewText && (
                              <p className="text-gray-600 dark:text-slate-300 leading-relaxed break-words line-clamp-3">
                                {previewText}
                              </p>
                            )}
                          </header>
                          {}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                            {}
                            <span className="text-sm text-gray-500 dark:text-slate-400">
                              {previewText ? 'Kurzvorschau' : 'Mehr Details verfügbar'}
                            </span>
                            {}
                            {postSlug ? (
                              <Link
                                to={`/pages/${normalizedSlug}/posts/${postSlug}`}
                                className="inline-flex items-center gap-2 text-primary-700 dark:text-primary-300 font-semibold hover:text-primary-800 dark:hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:rounded-lg"
                              >
                                Weiterlesen
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            ) : null}
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
