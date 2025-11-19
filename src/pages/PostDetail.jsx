import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CalendarDays, Loader2 } from 'lucide-react'
import MarkdownRenderer from '../components/MarkdownRenderer'
import Comments from '../components/Comments'
import { useContent } from '../context/ContentContext'
import { formatDate, normalizeSlug } from '../utils/postUtils'
const PostDetail = () => {
  const { pageSlug = '', postSlug = '' } = useParams()
  const navigate = useNavigate()
  const { pages } = useContent()
  const normalizedPageSlug = useMemo(() => normalizeSlug(pageSlug), [pageSlug])
  const normalizedPostSlug = useMemo(() => normalizeSlug(postSlug), [postSlug])
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!normalizedPageSlug || !normalizedPostSlug) {
      setError(new Error('Ungültige Seite oder Post'))
      setLoading(false)
      return
    }
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const pageData = await pages.fetch(normalizedPageSlug, { signal: controller.signal })
        if (controller.signal.aborted) return
        const foundPost = pageData.posts?.find(
          (p) => normalizeSlug(p.slug) === normalizedPostSlug
        )
        if (!foundPost) {
          throw new Error('Beitrag nicht gefunden')
        }
        setPost(foundPost)
      } catch (err) {
        if (controller.signal.aborted) return
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
  }, [normalizedPageSlug, normalizedPostSlug, pages])
  const handleDownloadPDF = async () => {
    try {
      setLoading(true)
      const element = document.getElementById('post-content')

      if (!element) {
        throw new Error('Inhalt nicht gefunden')
      }

      // Wait for all images to be loaded
      const images = Array.from(element.getElementsByTagName('img'))
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve) => {
            img.onload = resolve
            img.onerror = resolve
          })
        })
      )

      const opt = {
        margin: [10, 10],
        filename: `${post.slug}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          windowWidth: element.scrollWidth
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }

      // Robust import for html2pdf.js
      let html2pdf
      try {
        const module = await import('html2pdf.js')
        html2pdf = module.default || module
      } catch (e) {
        console.error('Failed to load html2pdf.js:', e)
        throw new Error('PDF-Bibliothek konnte nicht geladen werden')
      }

      if (typeof html2pdf !== 'function') {
        console.error('html2pdf is not a function:', html2pdf)
        throw new Error('PDF-Bibliothek ist fehlerhaft')
      }

      await html2pdf().set(opt).from(element).save()
    } catch (err) {
      console.error('PDF generation failed:', err)
      alert(`Fehler beim Erstellen des PDFs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const publishedDate = formatDate(post?.published_at)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(`/pages/${normalizedPageSlug}`)}
            className="group inline-flex items-center gap-2 text-primary-700 font-medium"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
            Zurück zur Übersicht
          </button>
          <div className="flex-grow" />
          <button
            onClick={handleDownloadPDF}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
            )}
            {loading ? 'Wird erstellt…' : 'PDF herunterladen'}
          </button>
        </div>

        {loading && !post ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Beitrag wird geladen…</p>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Beitrag konnte nicht geladen werden</h2>
              <p className="text-sm">{error?.message || 'Unbekannter Fehler'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <article id="post-content" className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-700/60 overflow-hidden">
              <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-8">
                <header className="space-y-4 pb-6 border-b border-gray-200 dark:border-slate-700">
                  {publishedDate && (
                    <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                      <CalendarDays className="w-4 h-4" />
                      {publishedDate}
                    </div>
                  )}
                  <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    {post?.title}
                  </h1>
                  {post?.excerpt && (
                    <p className="text-lg text-gray-600 dark:text-slate-300 leading-relaxed">
                      {post.excerpt}
                    </p>
                  )}
                </header>

                {post?.content_markdown && (
                  <MarkdownRenderer
                    content={post.content_markdown}
                    withBreaks
                    className="text-base sm:text-lg leading-8"
                  />
                )}
              </div>
            </article>

            <div className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-700/60 overflow-hidden p-6 sm:p-10">
              <Comments postId={post.id} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
export default PostDetail
