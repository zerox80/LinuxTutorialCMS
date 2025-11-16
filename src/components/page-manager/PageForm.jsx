import { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertCircle, FilePlus, RefreshCw, X } from 'lucide-react'
import { normalizeTitle } from '../../utils/postUtils'
import { sanitizeSlug, isValidSlug } from '../../utils/slug'
import { parseJsonField, sanitizeInteger } from './formUtils'

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
    title: '�ober diese Seite',
  },
  postsSection: {
    title: 'Beitr��ge',
    emptyTitle: 'Keine Beitr��ge vorhanden',
    emptyMessage: 'Sobald fǬr diese Seite Beitr��ge ver��ffentlicht werden, erscheinen sie hier.',
    countLabelSingular: '{count} ver��ffentlichter Beitrag',
    countLabelPlural: '{count} ver��ffentlichte Beitr��ge',
  },
}
const defaultLayoutJson = JSON.stringify(defaultLayoutConfig, null, 2)

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

export default PageForm
