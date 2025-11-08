import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { useTutorials } from '../context/TutorialContext'
import { api } from '../api/client'
import MarkdownRenderer from '../components/MarkdownRenderer'

/**
 * Renders the detailed view of a single tutorial.
 * It fetches the tutorial content based on the ID from the URL,
 * displays it using a Markdown renderer, and handles loading and error states.
 * @returns {JSX.Element} The rendered tutorial detail page.
 */
const TutorialDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getTutorial, tutorials } = useTutorials()

  const [tutorial, setTutorial] = useState(() => getTutorial(id))
  const [loading, setLoading] = useState(!getTutorial(id))
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchTutorial = async () => {
      try {
        setLoading(true)
        const data = await api.getTutorial(id, { signal: controller.signal })
        if (!controller.signal.aborted) {
          setTutorial(data)
          setError(null)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchTutorial()

    return () => {
      controller.abort()
    }
  }, [id])

  useEffect(() => {
    if (!Array.isArray(tutorials)) {
      setTutorial(null)
      return
    }
    const cached = tutorials.find((item) => item.id === id)
    setTutorial(cached || null)
  }, [id, tutorials])

  const topics = useMemo(() => {
    if (!tutorial?.topics) {
      return []
    }
    return Array.isArray(tutorial.topics) ? tutorial.topics : []
  }, [tutorial])

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 py-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={handleBack}
          className="group inline-flex items-center gap-2 text-primary-700 font-medium mb-8"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Zurück
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Inhalt wird geladen…</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Tutorial konnte nicht geladen werden</h2>
              <p className="text-sm">{error?.message || 'Unbekannter Fehler'}</p>
            </div>
          </div>
        ) : tutorial ? (
          <article className="bg-white dark:bg-slate-900/90 rounded-3xl shadow-xl border border-gray-200 dark:border-slate-800/70 overflow-hidden">
            <header className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-10">
              <div className="flex flex-col gap-4">
                <span className="inline-flex items-center gap-2 bg-white/15 px-4 py-2 rounded-full text-sm font-medium w-fit">
                  Linux Tutorial
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
                  {tutorial.title}
                </h1>
                <p className="text-primary-100 text-lg max-w-2xl">
                  {tutorial.description}
                </p>
              </div>
            </header>

            <div className="px-8 py-10 space-y-12">
              {topics.length > 0 && (
                <section>
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Was du lernen wirst</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {topics.map((topic, index) => (
                      <div
                        key={`${topic}-${index}`}
                        className="flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/60 px-4 py-3"
                      >
                        <span className="inline-flex items-center justify-center h-6 w-6 shrink-0 rounded-full bg-primary-600/10 text-primary-700 dark:text-primary-300 font-semibold text-sm">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 dark:text-slate-200 leading-relaxed">{topic}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-4">Inhalt</h2>
                <MarkdownRenderer
                  content={tutorial.content || 'Für dieses Tutorial liegt noch kein Inhalt vor.'}
                />
              </section>
            </div>
          </article>
        ) : (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
            Das gewünschte Tutorial wurde nicht gefunden.
          </div>
        )}
      </div>
    </main>
  )
}

export default TutorialDetail
