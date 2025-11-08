import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  AlertCircle,
  CalendarDays,
  Edit,
  Eye,
  EyeOff,
  FilePlus,
  FileText,
  Layers,
  Navigation,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import { useContent } from '../context/ContentContext'
import { normalizeTitle } from '../utils/postUtils'
import { sanitizeSlug, isValidSlug } from '../utils/slug'

const defaultHeroJson = JSON.stringify(
  {
    badge: 'Neue Seite',
    title: 'Titel der Seite',
    subtitle: 'Kurzbeschreibung deiner Seite',
    backgroundGradient: 'from-primary-600 to-primary-700',
  },
  null,
  2,
)

const defaultHeroTitle = normalizeTitle(JSON.parse(defaultHeroJson).title, '')

const defaultLayoutConfig = {
  aboutSection: {
    title: 'Über diese Seite',
  },
  postsSection: {
    title: 'Beiträge',
    emptyTitle: 'Keine Beiträge vorhanden',
    emptyMessage: 'Sobald für diese Seite Beiträge veröffentlicht werden, erscheinen sie hier.',
    countLabelSingular: '{count} veröffentlichter Beitrag',
    countLabelPlural: '{count} veröffentlichte Beiträge',
  },
}

const defaultLayoutJson = JSON.stringify(defaultLayoutConfig, null, 2)

const parseJsonField = (value, field) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return {}
  }
  try {
    return JSON.parse(trimmed)
  } catch (err) {
    const error = new Error(`Ungültiges JSON in Feld "${field}": ${err.message}`)
    error.field = field
    throw error
  }
}

const sanitizeInteger = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

/**
 * A form for creating and editing pages.
 * It includes fields for title, slug, description, navigation properties, and JSON configurations for hero and layout.
 * @param {object} props - The component props.
 * @param {'create' | 'edit'} props.mode - The form mode, either 'create' or 'edit'.
 * @param {object} [props.initialData] - The initial data for the form fields when in 'edit' mode.
 * @param {Function} props.onSubmit - The callback function to execute on form submission.
 * @param {Function} props.onCancel - The callback function to execute when the form is canceled.
 * @param {boolean} [props.submitting] - A flag indicating if the form is currently submitting.
 * @returns {JSX.Element} The rendered page form.
 */
const PageForm = ({ mode, initialData, onSubmit, onCancel, submitting }) => {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [slug, setSlug] = useState(initialData?.slug ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [navLabel, setNavLabel] = useState(initialData?.nav_label ?? '')
  const [showInNav, setShowInNav] = useState(Boolean(initialData?.show_in_nav))
  const [isPublished, setIsPublished] = useState(Boolean(initialData?.is_published))
  const [orderIndex, setOrderIndex] = useState(initialData?.order_index ?? 0)
  const [hero, setHero] = useState(
    initialData?.hero ? JSON.stringify(initialData.hero, null, 2) : defaultHeroJson,
  )
  const [layout, setLayout] = useState(
    initialData?.layout ? JSON.stringify(initialData.layout, null, 2) : defaultLayoutJson,
  )
  const [heroTitle, setHeroTitle] = useState(() => {
    if (initialData?.hero) {
      return normalizeTitle(initialData.hero.title ?? initialData.hero, initialData?.title ?? '')
    }
    return initialData?.title ?? defaultHeroTitle
  })
  const [error, setError] = useState(null)

  const formSanitizedSlug = useMemo(() => sanitizeSlug(slug), [slug])
  const slugHasInput = slug.trim().length > 0
  const slugHasInvalidCharacters = slugHasInput && !formSanitizedSlug
  const slugDiffersAfterSanitize =
    slugHasInput && formSanitizedSlug && formSanitizedSlug !== slug.trim()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    try {
      const trimmedTitle = title.trim()
      const trimmedDescription = description.trim()
      const trimmedNavLabel = navLabel.trim()
      const heroPayloadRaw = parseJsonField(hero, 'Hero JSON')
      const heroPayload =
        typeof heroPayloadRaw === 'object' && heroPayloadRaw !== null ? { ...heroPayloadRaw } : {}
      const trimmedHeroTitle = heroTitle.trim()
      const trimmedSlug = slug.trim()
      const sanitizedSlug = sanitizeSlug(trimmedSlug)

      if (trimmedHeroTitle) {
        heroPayload.title = trimmedHeroTitle
      } else if (!heroPayload.title) {
        heroPayload.title = trimmedTitle
      }

      if (!trimmedTitle) {
        throw new Error('Titel darf nicht leer sein.')
      }

      if (!sanitizedSlug) {
        throw new Error('Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.')
      }

      if (!isValidSlug(sanitizedSlug)) {
        throw new Error('Slug ist ungültig.')
      }

      const payload = {
        title: trimmedTitle,
        slug: sanitizedSlug,
        description: trimmedDescription,
        nav_label: trimmedNavLabel ? trimmedNavLabel : null,
        show_in_nav: showInNav,
        is_published: isPublished,
        order_index: sanitizeInteger(orderIndex),
        hero: heroPayload,
        layout: parseJsonField(layout, 'Layout JSON'),
      }

      await onSubmit(payload)
      setSlug(sanitizedSlug)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto dark:bg-slate-900">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
            {mode === 'edit' ? 'Seite bearbeiten' : 'Neue Seite erstellen'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Slug und JSON-Konfiguration beeinflussen die Darstellung der Seite.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-medium">Speichern fehlgeschlagen</p>
              <p>{error.message}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Titel
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Slug
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              onBlur={() => setSlug(formSanitizedSlug)}
              required
            />
            {slugHasInvalidCharacters && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt.
              </p>
            )}
            {slugDiffersAfterSanitize && !slugHasInvalidCharacters && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Gespeicherter Slug:{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] dark:bg-slate-800 dark:text-slate-200">{formSanitizedSlug}</code>
              </p>
            )}
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Navigationstitel
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={navLabel}
              onChange={(event) => setNavLabel(event.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Reihenfolge (Navigation)
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={orderIndex}
              onChange={(event) => setOrderIndex(event.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
          Beschreibung
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Kurzbeschreibung der Seite"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
          Hero-Titel
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            value={heroTitle}
            onChange={(event) => {
              const { value } = event.target
              setHeroTitle(value)
              const trimmedValue = value.trim()
              setHero((currentHero) => {
                try {
                  const parsed = parseJsonField(currentHero, 'Hero JSON')
                  const nextHero =
                    typeof parsed === 'object' && parsed !== null ? { ...parsed } : {}
                  if (trimmedValue) {
                    nextHero.title = trimmedValue
                  } else {
                    delete nextHero.title
                  }
                  return JSON.stringify(nextHero, null, 2)
                } catch (err) {
                  return currentHero
                }
              })
            }}
            placeholder="Titel im oberen Bereich der Seite"
          />
          <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
            Wird beim Speichern automatisch in das Hero JSON übernommen.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
              checked={showInNav}
              onChange={(event) => setShowInNav(event.target.checked)}
            />
            In Navigation anzeigen
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
              checked={isPublished}
              onChange={(event) => setIsPublished(event.target.checked)}
            />
            Veröffentlicht
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Hero JSON
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              rows={8}
              value={hero}
              onChange={(event) => {
                const { value } = event.target
                setHero(value)
                try {
                  const parsed = JSON.parse(value)
                  const derivedTitle = normalizeTitle(parsed?.title ?? parsed, '').trim()
                  setHeroTitle((previous) =>
                    derivedTitle !== previous ? derivedTitle : previous,
                  )
                } catch (err) {
                  // Ignore JSON parse errors while the user is typing
                }
              }}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Layout JSON
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              rows={8}
              value={layout}
              onChange={(event) => setLayout(event.target.value)}
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-slate-400">
              Verwendet u.a. <code>aboutSection.title</code>, <code>postsSection.title</code>,{' '}
              <code>postsSection.emptyTitle</code>, <code>postsSection.emptyMessage</code>.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-primary-700 hover:to-primary-800"
            disabled={submitting}
          >
            {submitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus className="h-4 w-4" />
            )}
            <span>{mode === 'edit' ? 'Änderungen speichern' : 'Seite erstellen'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

PageForm.propTypes = {
  mode: PropTypes.oneOf(['create', 'edit']).isRequired,
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
}

/**
 * A form for creating and editing posts.
 * It includes fields for title, slug, excerpt, Markdown content, and publishing options.
 * @param {object} props - The component props.
 * @param {'create' | 'edit'} props.mode - The form mode, either 'create' or 'edit'.
 * @param {object} [props.initialData] - The initial data for the form fields when in 'edit' mode.
 * @param {Function} props.onSubmit - The callback function to execute on form submission.
 * @param {Function} props.onCancel - The callback function to execute when the form is canceled.
 * @param {boolean} [props.submitting] - A flag indicating if the form is currently submitting.
 * @returns {JSX.Element} The rendered post form.
 */
const PostForm = ({ mode, initialData, onSubmit, onCancel, submitting }) => {
  const [title, setTitle] = useState(initialData?.title ?? '')
  const [slug, setSlug] = useState(initialData?.slug ?? '')
  const [excerpt, setExcerpt] = useState(initialData?.excerpt ?? '')
  const [content, setContent] = useState(initialData?.content_markdown ?? '')
  const [orderIndex, setOrderIndex] = useState(initialData?.order_index ?? 0)
  const [isPublished, setIsPublished] = useState(Boolean(initialData?.is_published))
  const [publishedAt, setPublishedAt] = useState(initialData?.published_at ?? '')
  const [error, setError] = useState(null)

  const sanitizedPostSlug = useMemo(() => sanitizeSlug(slug), [slug])
  const postSlugHasInput = slug.trim().length > 0
  const postSlugInvalid = postSlugHasInput && !sanitizedPostSlug
  const postSlugDiffers =
    postSlugHasInput && sanitizedPostSlug && sanitizedPostSlug !== slug.trim()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)

    try {
      if (!title.trim()) {
        throw new Error('Titel darf nicht leer sein.')
      }
      if (!slug.trim()) {
        throw new Error('Slug darf nicht leer sein.')
      }
      if (!content.trim()) {
        throw new Error('Inhalt darf nicht leer sein.')
      }

      const sanitizedSlug = sanitizeSlug(slug.trim())

      if (!sanitizedSlug) {
        throw new Error('Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.')
      }

      if (!isValidSlug(sanitizedSlug)) {
        throw new Error('Slug ist ungültig.')
      }

      const payload = {
        title: title.trim(),
        slug: sanitizedSlug,
        excerpt: excerpt.trim() || null,
        content_markdown: content,
        order_index: sanitizeInteger(orderIndex),
        is_published: isPublished,
        published_at: publishedAt.trim() ? publishedAt : null,
      }

      await onSubmit(payload)
      setSlug(sanitizedSlug)
    } catch (err) {
      setError(err)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto dark:bg-slate-900">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-slate-800">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
            {mode === 'edit' ? 'Beitrag bearbeiten' : 'Neuen Beitrag erstellen'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Inhalte werden als Markdown gespeichert und auf der Seite gerendert.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <p className="font-medium">Speichern fehlgeschlagen</p>
              <p>{error.message}</p>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Titel
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Slug
            <input
              type="text"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              onBlur={() => setSlug(sanitizedPostSlug)}
              required
            />
            {postSlugInvalid && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                Nur Kleinbuchstaben, Zahlen und Bindestriche erlaubt.
              </p>
            )}
            {postSlugDiffers && !postSlugInvalid && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Gespeicherter Slug:{' '}
                <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] dark:bg-slate-800 dark:text-slate-200">{sanitizedPostSlug}</code>
              </p>
            )}
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Reihenfolge
            <input
              type="number"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={orderIndex}
              onChange={(event) => setOrderIndex(event.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
            Veröffentlichungsdatum (optional)
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              value={publishedAt || ''}
              onChange={(event) => setPublishedAt(event.target.value)}
              disabled={!isPublished}
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
          Auszug
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            rows={3}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="Kurze Zusammenfassung des Beitrags"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200">
          Inhalt (Markdown)
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            rows={12}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
          />
        </label>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-slate-600 dark:bg-slate-900"
            checked={isPublished}
            onChange={(event) => setIsPublished(event.target.checked)}
          />
          Veröffentlicht
        </label>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-primary-700 hover:to-primary-800"
            disabled={submitting}
          >
            {submitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span>{mode === 'edit' ? 'Änderungen speichern' : 'Beitrag erstellen'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}

PostForm.propTypes = {
  mode: PropTypes.oneOf(['create', 'edit']).isRequired,
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  submitting: PropTypes.bool,
}

/**
 * A panel that displays and manages the posts for a selected page.
 * It shows a list of posts, provides controls for creating, editing, and deleting them,
 * and indicates the loading and error states.
 * @param {object} props - The component props.
 * @param {object} props.page - The page to which the posts belong.
 * @param {Array<object>} props.posts - The list of posts to display.
 * @param {Function} props.onCreate - The callback to trigger the creation of a new post.
 * @param {Function} props.onEdit - The callback to trigger editing of a post.
 * @param {Function} props.onDelete - The callback to trigger deletion of a post.
 * @param {boolean} props.loading - A flag indicating if the posts are currently loading.
 * @param {Error} [props.error] - An error object if fetching posts failed.
 * @param {Function} props.onRefresh - The callback to refresh the list of posts.
 * @returns {JSX.Element} The rendered posts panel.
 */
const PostsPanel = ({ page, posts, onCreate, onEdit, onDelete, loading, error, onRefresh }) => {
  const publishedCount = useMemo(
    () => posts.filter((post) => post.is_published).length,
    [posts],
  )

  return (
    <div className="bg-white shadow-lg border border-gray-200 rounded-2xl p-6 space-y-6 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Beiträge für „{page.title}“</h3>
          <p className="text-sm text-gray-600 dark:text-slate-300">
            {publishedCount} von {posts.length} Beiträgen veröffentlicht.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:from-primary-700 hover:to-primary-800"
          >
            <Plus className="h-4 w-4" />
            Beitrag erstellen
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <div>
            <p className="font-semibold">Beiträge konnten nicht geladen werden</p>
            <p>{error?.message || 'Unbekannter Fehler'}</p>
          </div>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-slate-400">Beiträge werden geladen…</div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center text-gray-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
          Noch keine Beiträge für diese Seite vorhanden.
        </div>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="px-5 py-5 space-y-4">
                <header className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                    {post.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-green-700 text-xs font-medium">
                        <Eye className="h-3.5 w-3.5" /> Veröffentlicht
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600 text-xs font-medium">
                        <EyeOff className="h-3.5 w-3.5" /> Entwurf
                      </span>
                    )}
                    {post.published_at && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-4 w-4" />
                        {new Date(post.published_at).toLocaleString('de-DE')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-4 w-4" /> Ordnung: {post.order_index ?? 0}
                    </span>
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{post.title}</h4>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 line-clamp-2 dark:text-slate-300">{post.excerpt}</p>
                  )}
                </header>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
                  <button
                    onClick={() => onEdit(post)}
                    className="inline-flex items-center gap-2 rounded-lg border border-primary-100 px-3 py-1.5 text-sm text-primary-700 hover:bg-primary-50 dark:border-primary-900/50 dark:text-primary-200 dark:hover:bg-primary-900/40"
                  >
                    <Edit className="h-4 w-4" /> Bearbeiten
                  </button>
                  <button
                    onClick={() => onDelete(post)}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-200 dark:hover:bg-red-900/30"
                  >
                    <Trash2 className="h-4 w-4" /> Löschen
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

PostsPanel.propTypes = {
  page: PropTypes.object.isRequired,
  posts: PropTypes.array.isRequired,
  onCreate: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.any,
  onRefresh: PropTypes.func.isRequired,
}

/**
 * A comprehensive admin component for managing dynamic pages and their associated posts.
 * It provides an interface to create, read, update, and delete pages and posts,
 * and displays an overview of navigation and published content.
 * @returns {JSX.Element} The rendered page manager component.
 */
/**
 * Administrative dashboard widget for browsing, filtering, and editing site pages and their posts.
 *
 * @returns {JSX.Element} Management console with navigation tree, detail panels, and editor modals.
 */
const PageManager = () => {
  const { navigation, pages: publishedPages } = useContent()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPageId, setSelectedPageId] = useState(null)

  const [pageFormMode, setPageFormMode] = useState(null)
  const [pageFormData, setPageFormData] = useState(null)
  const [pageFormSubmitting, setPageFormSubmitting] = useState(false)

  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsError, setPostsError] = useState(null)
  const postsRequestRef = useRef(0)

  const [postFormMode, setPostFormMode] = useState(null)
  const [postFormData, setPostFormData] = useState(null)
  const [postFormSubmitting, setPostFormSubmitting] = useState(false)
  const pagesAbortRef = useRef(null)
  const postsAbortRef = useRef(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      pagesAbortRef.current?.abort()
      postsAbortRef.current?.abort()
    }
  }, [])

  const selectedPage = useMemo(
    () => pages.find((item) => item.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )

  const loadPages = useCallback(async () => {
    const controller = new AbortController()
    if (pagesAbortRef.current) {
      pagesAbortRef.current.abort()
    }
    pagesAbortRef.current = controller

    try {
      setLoading(true)
      setError(null)

      const data = await api.listPages({ signal: controller.signal })
      if (controller.signal.aborted || !isMountedRef.current) {
        return
      }

      const items = Array.isArray(data?.items) ? data.items : []
      setPages(items)
      if (items.length === 0) {
        postsRequestRef.current += 1
        setSelectedPageId(null)
        setPosts([])
        setPostsError(null)
        setPostsLoading(false)
        return
      }

      if (!items.find((item) => item.id === selectedPageId)) {
        setSelectedPageId(items[0].id)
      }
    } catch (err) {
      if (!controller.signal.aborted && isMountedRef.current) {
        setError(err)
      }
    } finally {
      if (pagesAbortRef.current === controller) {
        pagesAbortRef.current = null
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }
  }, [selectedPageId])

  const refreshNavigation = useCallback(() => {
    navigation?.refresh?.()
    publishedPages?.refresh?.()
  }, [navigation, publishedPages])

  const loadPosts = useCallback(
    async (pageId) => {
      if (!pageId) {
        postsRequestRef.current += 1
        if (postsAbortRef.current) {
          postsAbortRef.current.abort()
          postsAbortRef.current = null
        }
        setPosts([])
        setPostsLoading(false)
        setPostsError(null)
        return
      }

      const controller = new AbortController()
      if (postsAbortRef.current) {
        postsAbortRef.current.abort()
      }
      postsAbortRef.current = controller

      const requestId = postsRequestRef.current + 1
      postsRequestRef.current = requestId

      setPostsLoading(true)
      setPostsError(null)
      try {
        const data = await api.listPosts(pageId, { signal: controller.signal })
        if (controller.signal.aborted || postsRequestRef.current !== requestId || !isMountedRef.current) {
          return
        }
        const items = Array.isArray(data?.items) ? data.items : []
        setPosts(items)
      } catch (err) {
        if (!controller.signal.aborted && postsRequestRef.current === requestId && isMountedRef.current) {
          setPostsError(err)
        }
      } finally {
        if (postsAbortRef.current === controller) {
          postsAbortRef.current = null
        }
        if (!controller.signal.aborted && postsRequestRef.current === requestId && isMountedRef.current) {
          setPostsLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    loadPages()
  }, [loadPages])

  useEffect(() => {
    if (selectedPageId) {
      loadPosts(selectedPageId)
    }
  }, [selectedPageId, loadPosts])

  const handleCreatePage = () => {
    setPageFormMode('create')
    setPageFormData(null)
  }

  const handleEditPage = (page) => {
    setPageFormMode('edit')
    setPageFormData(page)
  }

  const handleDeletePage = async (page) => {
    const pageId = page?.id
    if (!pageId) {
      return
    }
    if (!window.confirm('Soll diese Seite wirklich gelöscht werden? Alle zugehörigen Beiträge werden ebenfalls entfernt.')) {
      return
    }
    try {
      const pageSlug = page?.slug
      await api.deletePage(pageId)
      if (pageSlug) {
        publishedPages?.invalidate?.(pageSlug)
      } else {
        publishedPages?.invalidate?.()
      }
      await loadPages()
      refreshNavigation()
    } catch (err) {
      alert(err?.message || 'Seite konnte nicht gelöscht werden')
    }
  }

  const submitPageForm = async (payload) => {
    try {
      setPageFormSubmitting(true)
      let response
      if (pageFormMode === 'edit' && pageFormData?.id) {
        response = await api.updatePage(pageFormData.id, payload)
      } else {
        response = await api.createPage(payload)
      }

      const previousSlug = pageFormMode === 'edit' ? pageFormData?.slug : null
      const nextSlug = response?.slug ?? payload?.slug ?? previousSlug

      if (previousSlug && previousSlug !== nextSlug) {
        publishedPages?.invalidate?.(previousSlug)
      }
      if (nextSlug) {
        publishedPages?.invalidate?.(nextSlug)
      }

      setPageFormMode(null)
      setPageFormData(null)
      await loadPages()
      refreshNavigation()
      publishedPages?.refresh?.()
    } finally {
      setPageFormSubmitting(false)
    }
  }

  const handleCreatePost = () => {
    if (!selectedPage) return
    setPostFormMode('create')
    setPostFormData(null)
  }

  const handleEditPost = (post) => {
    setPostFormMode('edit')
    setPostFormData(post)
  }

  const handleDeletePost = async (post) => {
    if (!window.confirm('Soll dieser Beitrag wirklich gelöscht werden?')) {
      return
    }
    try {
      await api.deletePost(post.id)
      if (selectedPage?.slug) {
        publishedPages?.invalidate?.(selectedPage.slug)
      } else {
        publishedPages?.invalidate?.()
      }
      await loadPosts(selectedPageId)
    } catch (err) {
      alert(err?.message || 'Beitrag konnte nicht gelöscht werden')
    }
  }

  const submitPostForm = async (payload) => {
    if (!selectedPageId) {
      return
    }

    try {
      setPostFormSubmitting(true)
      if (postFormMode === 'edit' && postFormData?.id) {
        await api.updatePost(postFormData.id, payload)
      } else {
        await api.createPost(selectedPageId, payload)
      }
      if (selectedPage?.slug) {
        publishedPages?.invalidate?.(selectedPage.slug)
      } else {
        publishedPages?.invalidate?.()
      }
      setPostFormMode(null)
      setPostFormData(null)
      await loadPosts(selectedPageId)
      refreshNavigation()
    } finally {
      setPostFormSubmitting(false)
    }
  }

  const closePageForm = () => {
    setPageFormMode(null)
    setPageFormData(null)
  }

  const closePostForm = () => {
    setPostFormMode(null)
    setPostFormData(null)
  }

  const dynamicPagesInNav = navigation?.dynamic?.length ?? 0
  const totalPublishedPages = publishedPages?.publishedSlugs?.length ?? 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seiten & Beiträge</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Verwalte dynamische Seiten, Navigationseinträge und veröffentlichte Beiträge.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadPages}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Seiten aktualisieren
          </button>
          <button
            onClick={handleCreatePage}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-primary-700 hover:to-primary-800"
          >
            <Plus className="h-4 w-4" /> Neue Seite
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 dark:border-gray-800">
            <Navigation className="h-5 w-5 text-primary-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Navigation</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {dynamicPagesInNav} dynamische Seite{dynamicPagesInNav === 1 ? '' : 'n'} im Menü
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {(navigation?.dynamic ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>{item.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">/pages/{item.slug}</span>
              </div>
            ))}
            {dynamicPagesInNav === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine dynamischen Seiten in der Navigation.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 dark:border-gray-800">
            <Eye className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Veröffentlichungen</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {totalPublishedPages} veröffentlichte Seite{totalPublishedPages === 1 ? '' : 'n'}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {(publishedPages?.publishedSlugs ?? []).map((slugValue) => (
              <div key={slugValue} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                <span>/pages/{slugValue}</span>
              </div>
            ))}
            {totalPublishedPages === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">Noch keine Seite veröffentlicht.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-slate-900">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4 dark:border-gray-800">
            <Layers className="h-5 w-5 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Seitenübersicht</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {pages.length} Seite{pages.length === 1 ? '' : 'n'} insgesamt
              </p>
            </div>
          </div>
          <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p>
              <span className="font-semibold">Ausgewählt:</span>{' '}
              {selectedPage ? selectedPage.title : 'Keine Seite ausgewählt'}
            </p>
            <p>
              <span className="font-semibold">Entwürfe:</span>{' '}
              {pages.filter((page) => !page.is_published).length}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <div>
            <p className="font-semibold">Seiten konnten nicht geladen werden</p>
            <p>{error?.message || 'Unbekannter Fehler'}</p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {loading && pages.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-400">
              Seiten werden geladen…
            </div>
          ) : pages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600 dark:border-gray-600 dark:bg-slate-900/50 dark:text-gray-300">
              Noch keine Seiten vorhanden. Erstelle deine erste Seite, um Beiträge zu veröffentlichen.
            </div>
          ) : (
            pages.map((page) => {
              const isSelected = page.id === selectedPageId
              return (
                <div
                  key={page.id}
                  className={`rounded-2xl border ${
                    isSelected
                      ? 'border-primary-300 bg-primary-50/60 shadow-lg dark:border-primary-700 dark:bg-primary-900/40'
                      : 'border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
                  } transition-shadow duration-200`}
                >
                  <div className="px-5 py-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
                          page.is_published
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {page.is_published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {page.is_published ? 'Veröffentlicht' : 'Entwurf'}
                      </span>
                      {page.show_in_nav && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                          <Navigation className="h-3.5 w-3.5" /> Navigation
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                        <FileText className="h-3.5 w-3.5" /> /pages/{page.slug}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{page.title}</h3>
                      {page.description && (
                        <p className="mt-1 text-sm text-gray-600 line-clamp-2 dark:text-slate-300">{page.description}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSelectedPageId(page.id)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                          isSelected
                            ? 'border-primary-200 bg-primary-100 text-primary-800 dark:border-primary-600 dark:bg-primary-900/50 dark:text-primary-100'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Layers className="h-4 w-4" /> Beiträge ansehen
                      </button>
                      <button
                        onClick={() => handleEditPage(page)}
                        className="inline-flex items-center gap-2 rounded-lg border border-primary-100 px-3 py-1.5 text-sm text-primary-700 hover:bg-primary-50 dark:border-primary-900/50 dark:text-primary-200 dark:hover:bg-primary-900/40"
                      >
                        <Edit className="h-4 w-4" /> Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeletePage(page)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-200 dark:hover:bg-red-900/30"
                      >
                        <Trash2 className="h-4 w-4" /> Löschen
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div>
          {selectedPage ? (
            <PostsPanel
              page={selectedPage}
              posts={posts}
              loading={postsLoading}
              error={postsError}
              onCreate={handleCreatePost}
              onEdit={handleEditPost}
              onDelete={handleDeletePost}
              onRefresh={() => loadPosts(selectedPageId)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-500">
              Wähle eine Seite aus, um ihre Beiträge zu verwalten.
            </div>
          )}
        </div>
      </div>

      {(pageFormMode || postFormMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          {pageFormMode && (
            <PageForm
              mode={pageFormMode}
              initialData={pageFormData}
              submitting={pageFormSubmitting}
              onSubmit={submitPageForm}
              onCancel={closePageForm}
            />
          )}
          {postFormMode && (
            <PostForm
              mode={postFormMode}
              initialData={postFormData}
              submitting={postFormSubmitting}
              onSubmit={submitPostForm}
              onCancel={closePostForm}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default PageManager
