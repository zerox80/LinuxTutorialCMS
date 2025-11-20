import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import Comments from '../components/Comments'
import { useContent } from '../context/ContentContext'
import { normalizeSlug } from '../utils/postUtils'
import PostControls from '../components/post/PostControls'
import PostContent from '../components/post/PostContent'

const PostDetail = () => {
  const { pageSlug = '', postSlug = '' } = useParams()
  const navigate = useNavigate()
  const { pages } = useContent()
  const normalizedPageSlug = useMemo(() => normalizeSlug(pageSlug), [pageSlug])
  const normalizedPostSlug = useMemo(() => normalizeSlug(postSlug), [postSlug])
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pdfEnabled, setPdfEnabled] = useState(true)

  useEffect(() => {
    // Fetch global settings
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/content/settings')
        if (response.ok) {
          const data = await response.json()
          if (data.content && typeof data.content.pdfEnabled === 'boolean') {
            setPdfEnabled(data.content.pdfEnabled)
          }
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err)
      }
    }
    fetchSettings()
  }, [])

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

      // Dynamically import the generator to keep bundle size small
      const { generatePdf } = await import('../utils/pdfGenerator')

      await generatePdf(element, `${post.slug}.pdf`)

    } catch (err) {
      console.error('PDF generation failed:', err)
      alert(`Fehler beim Erstellen des PDFs: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <PostControls
          onBack={() => navigate(`/pages/${normalizedPageSlug}`)}
          onDownload={pdfEnabled ? handleDownloadPDF : undefined}
          loading={loading}
        />

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
            <PostContent post={post} />

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
