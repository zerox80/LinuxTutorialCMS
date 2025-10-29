import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CalendarDays, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { useContent } from '../context/ContentContext'
import { formatDate, normalizeSlug } from '../utils/postUtils'

const PostDetail = () => {
  const { pageSlug = '', postSlug = '' } = useParams()
  const navigate = useNavigate()
  const { pages } = useContent()

  const normalizedPageSlug = useMemo(() => normalizeSlug(pageSlug), [pageSlug])
  const normalizedPostSlug = useMemo(() => normalizeSlug(postSlug), [postSlug])

  const [post, setPost] = useState(null)
  const [page, setPage] = useState(null)
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

        setPage(pageData.page)
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

  const publishedDate = formatDate(post?.published_at)

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <button
          onClick={() => navigate(`/pages/${normalizedPageSlug}`)}
          className="group inline-flex items-center gap-2 text-primary-700 font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Zurück zur Übersicht
        </button>

        {loading ? (
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
          <article className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-8 sm:px-10 sm:py-10 space-y-8">
              <header className="space-y-4 pb-6 border-b border-gray-200">
                {publishedDate && (
                  <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                    <CalendarDays className="w-4 h-4" />
                    {publishedDate}
                  </div>
                )}
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">
                  {post?.title}
                </h1>
                {post?.excerpt && (
                  <p className="text-lg text-gray-600 leading-relaxed">
                    {post.excerpt}
                  </p>
                )}
              </header>

              {post?.content_markdown && (
                <div className="prose prose-lg prose-slate max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight]}
                    components={{
                      h1: ({ children }) => (
                        <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-4">
                          {children}
                        </h2>
                      ),
                      h2: ({ children }) => (
                        <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">
                          {children}
                        </h3>
                      ),
                      h3: ({ children }) => (
                        <h4 className="text-lg font-semibold text-gray-900 mt-4 mb-2">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-gray-700 leading-relaxed mb-4">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-700">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="ml-4">{children}</li>
                      ),
                      code: ({ inline, children }) =>
                        inline ? (
                          <code className="bg-gray-100 text-primary-700 px-1.5 py-0.5 rounded text-sm font-mono">
                            {children}
                          </code>
                        ) : (
                          <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono mb-4">
                            {children}
                          </code>
                        ),
                      pre: ({ children }) => (
                        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4">
                          {children}
                        </pre>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 border-primary-500 pl-4 italic text-gray-600 my-4">
                          {children}
                        </blockquote>
                      ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          className="text-primary-700 hover:text-primary-800 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {post.content_markdown}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </article>
        )}
      </div>
    </main>
  )
}

export default PostDetail
