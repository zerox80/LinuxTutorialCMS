import { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { AlertCircle, ArrowLeft, Check, Loader2, RefreshCw } from 'lucide-react'
import {
  useContent,
  CONTENT_SECTIONS,
  DEFAULT_CONTENT,
} from '../../context/ContentContext'
import { getIconComponent } from '../../utils/iconMap'

const sectionLabels = {
  hero: 'Hero-Bereich',
  tutorial_section: 'Tutorial-Sektion',
  header: 'Navigation & Header',
  footer: 'Footer',
  grundlagen_page: 'Grundlagen-Seite',
  site_meta: 'Seitentitel & Beschreibung',
}

/**
 * Deep clones content object using JSON serialization.
 * 
 * @param {*} value - Value to clone
 * @returns {Object} Cloned object or empty object if value is null/undefined
 */
const cloneContent = (value) => {
  if (value === undefined || value === null) {
    return {}
  }
  return JSON.parse(JSON.stringify(value))
}

/**
 * Sets a nested value in an object using a path array.
 * 
 * @param {Object} obj - Object to modify
 * @param {Array<string>} path - Path to the nested property
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 */
const setNestedValue = (obj, path, value) => {
  if (!Array.isArray(path) || path.length === 0) {
    return obj
  }
  let cursor = obj
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    if (typeof cursor[key] !== 'object' || cursor[key] === null) {
      cursor[key] = {}
    }
    cursor = cursor[key]
  }
  cursor[path[path.length - 1]] = value
  return obj
}

/**
 * Section picker component for selecting content sections to edit.
 * 
 * @param {Object} props - Component props
 * @param {Array<string>} props.sections - Available section identifiers
 * @param {string} [props.selected] - Currently selected section
 * @param {Function} props.onSelect - Callback when section is selected
 * @returns {JSX.Element} Rendered section picker grid
 */
const SectionPicker = ({ sections, selected, onSelect }) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sections.map((section) => {
        const label = sectionLabels[section] || section
        const isActive = selected === section
        return (
          <button
            key={section}
            type="button"
            onClick={() => onSelect(section)}
            className={`rounded-xl border px-4 py-3 text-left transition-all ${
              isActive
                ? 'border-primary-600 bg-primary-50 text-primary-700 shadow-sm'
                : 'border-gray-200 text-gray-700 hover:border-primary-200 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{section}</p>
          </button>
        )
      })}
    </div>
  )
}

SectionPicker.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.string).isRequired,
  selected: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
}

const SectionToolbar = ({ onBack, onReset, onSave, isSaving, hasChanges }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
    >
      <ArrowLeft className="h-4 w-4" />
      Zurück zur Auswahl
    </button>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        disabled={!hasChanges || isSaving}
      >
        Änderungen verwerfen
      </button>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:from-primary-700 hover:to-primary-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!hasChanges || isSaving}
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Speichern
      </button>
    </div>
  </div>
)

SectionToolbar.propTypes = {
  onBack: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isSaving: PropTypes.bool,
  hasChanges: PropTypes.bool,
}

const ContentJsonEditor = ({ value, onChange, error, schemaHint }) => (
  <div className="space-y-3">
    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-200">JSON-Inhalt</label>
    <textarea
      className="min-h-[420px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600">
      <p className="font-semibold">Strukturhinweis</p>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-gray-500">
{schemaHint}
      </pre>
    </div>
    {error && (
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
        <AlertCircle className="h-4 w-4" />
        <span>JSON-Fehler: {error}</span>
      </div>
    )}
  </div>
)

ContentJsonEditor.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  schemaHint: PropTypes.string,
}

const HeroPreview = ({ content }) => {
  const HeroIcon = getIconComponent(content.icon, 'Terminal')
  const features = Array.isArray(content.features) ? content.features : []

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 p-3 text-white">
            <HeroIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Badge</p>
            <p className="text-lg font-semibold text-gray-900">{content.badgeText}</p>
          </div>
        </div>
        <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
          Vorschau
        </span>
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-bold text-gray-900">
          {content?.title?.line1}
          <br />
          <span className="bg-gradient-to-r from-yellow-200 via-yellow-100 to-yellow-200 bg-clip-text text-transparent">
            {content?.title?.line2}
          </span>
        </h3>
        <p className="text-gray-600">
          {content.subtitle}
          {content.subline && <span className="block text-sm text-gray-500">{content.subline}</span>}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, idx) => {
          const FeatureIcon = getIconComponent(feature.icon, 'Terminal')
          return (
            <div key={`${feature.title}-${idx}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="flex items-center gap-2 text-primary-700">
                <FeatureIcon className="h-4 w-4" />
                <span className="text-sm font-semibold">{feature.title}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600">{feature.description}</p>
            </div>
          )
        })}
        {features.length === 0 && (
          <p className="col-span-full text-sm text-gray-500">Keine Feature-Karten konfiguriert.</p>
        )}
      </div>
    </div>
  )
}

HeroPreview.propTypes = {
  content: PropTypes.object.isRequired,
}

const HeroContentForm = ({ content, onFieldChange }) => {
  const heroContent = content || {}
  const title = heroContent.title || {}

  const handleChange = (path) => (event) => {
    onFieldChange(path, event.target.value)
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Hero-Inhalt bearbeiten</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Titel Zeile 1</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            value={title.line1 || ''}
            onChange={handleChange(['title', 'line1'])}
            placeholder="z. B. Lerne Linux"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Titel Zeile 2</label>
          <input
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            value={title.line2 || ''}
            onChange={handleChange(['title', 'line2'])}
            placeholder="z. B. von Grund auf"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Untertitel</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            rows="2"
            value={heroContent.subtitle || ''}
            onChange={handleChange(['subtitle'])}
            placeholder="Kurze Beschreibung"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Subline</label>
          <textarea
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            rows="2"
            value={heroContent.subline || ''}
            onChange={handleChange(['subline'])}
            placeholder="Zusätzlicher Satz unter dem Untertitel"
          />
        </div>
      </div>
    </div>
  )
}

HeroContentForm.propTypes = {
  content: PropTypes.object,
  onFieldChange: PropTypes.func.isRequired,
}

const SiteMetaPreview = ({ content }) => {
  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Seitentitel (Tab)</h4>
        <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
          Vorschau
        </span>
      </div>
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-sm font-semibold text-gray-800">{content?.title || 'Linux Tutorial - Lerne Linux Schritt für Schritt'}</p>
        <p className="mt-2 text-sm text-gray-600 leading-relaxed">
          {content?.description || 'Lerne Linux von Grund auf - Interaktiv, modern und praxisnah.'}
        </p>
      </div>
      <p className="text-xs text-gray-500">
        Diese Angaben erscheinen als Browser-Titel und Meta-Beschreibung (z. B. in Suchmaschinen).
      </p>
    </div>
  )
}

SiteMetaPreview.propTypes = {
  content: PropTypes.object.isRequired,
}

const SiteMetaForm = ({ content, onFieldChange }) => {
  const siteMeta = content || {}

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Seitentitel & Beschreibung</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="site-meta-title">
            Browser-Titel
          </label>
          <input
            id="site-meta-title"
            type="text"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            value={siteMeta.title || ''}
            onChange={(event) => onFieldChange(['title'], event.target.value)}
            placeholder="z. B. Linux Tutorial - Lerne Linux Schritt für Schritt"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="site-meta-description">
            Meta-Beschreibung
          </label>
          <textarea
            id="site-meta-description"
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400"
            rows="3"
            value={siteMeta.description || ''}
            onChange={(event) => onFieldChange(['description'], event.target.value)}
            placeholder="Kurze Beschreibung, die in Suchergebnissen angezeigt wird"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Empfehlung: 50–160 Zeichen, enthält wichtige Schlüsselbegriffe.
          </p>
        </div>
      </div>
    </div>
  )
}

SiteMetaForm.propTypes = {
  content: PropTypes.object,
  onFieldChange: PropTypes.func.isRequired,
}

const TutorialSectionPreview = ({ content }) => {
  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h4 className="text-lg font-semibold text-gray-900">Tutorial-Sektion</h4>
        <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700">
          Vorschau
        </span>
      </div>
      
      <div className="space-y-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Badge</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{content.badge || 'Tutorials'}</p>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Titel</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{content.title || 'Linux Tutorials'}</p>
        </div>
        
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Untertitel</p>
          <p className="mt-1 text-sm text-gray-700">{content.subtitle || 'Lerne die Grundlagen'}</p>
        </div>
        
        <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-primary-600">Button-Text</p>
          <p className="mt-1 text-sm font-semibold text-primary-700">{content.tutorialCardButton || 'Zum Tutorial'}</p>
          <p className="mt-1 text-xs text-primary-600">Dieser Text erscheint auf den Tutorial-Karten</p>
        </div>
      </div>
    </div>
  )
}

TutorialSectionPreview.propTypes = {
  content: PropTypes.object.isRequired,
}

const SectionPreview = ({ section, content }) => {
  switch (section) {
    case 'hero':
      return <HeroPreview content={content} />
    case 'tutorial_section':
      return <TutorialSectionPreview content={content} />
    case 'site_meta':
      return <SiteMetaPreview content={content} />
    default:
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          <p className="font-semibold text-gray-700">Keine visuelle Vorschau für diesen Abschnitt vorhanden.</p>
          <p className="mt-2 text-gray-500">
            Bearbeite die JSON-Struktur links. Änderungen sind sofort nach dem Speichern auf der Seite sichtbar.
          </p>
        </div>
      )
  }
}

SectionPreview.propTypes = {
  section: PropTypes.string.isRequired,
  content: PropTypes.object.isRequired,
}

/**
 * Main site content editor component for managing CMS content.
 * Provides JSON editing with visual preview for different content sections.
 * 
 * @returns {JSX.Element} Rendered content editor interface
 */
const SiteContentEditor = () => {
  const {
    content,
    loading,
    error,
    refreshContent,
    getSection,
    getDefaultSection,
    updateSection,
    savingSections,
  } = useContent()

  const sectionOptions = useMemo(() => {
    const base = [...CONTENT_SECTIONS]
    const extraKeys = content
      ? Object.keys(content).filter((key) => !base.includes(key))
      : []
    return [...base, ...extraKeys.sort()]
  }, [content])

  const [selectedSection, setSelectedSection] = useState(null)
  const [originalContent, setOriginalContent] = useState(null)
  const [draftContent, setDraftContent] = useState(null)
  const [editorValue, setEditorValue] = useState('')
  const [jsonError, setJsonError] = useState(null)
  const [status, setStatus] = useState(null)

  const activeContent = useMemo(() => {
    if (!selectedSection) {
      return null
    }
    if (content && content[selectedSection] !== undefined) {
      return content[selectedSection]
    }
    return getSection(selectedSection)
  }, [content, getSection, selectedSection])

  useEffect(() => {
    if (!selectedSection) {
      return
    }

    const current = cloneContent(activeContent ?? getDefaultSection(selectedSection) ?? DEFAULT_CONTENT[selectedSection])
    setOriginalContent(current)
    setDraftContent(current)
    setEditorValue(JSON.stringify(current, null, 2))
    setJsonError(null)
    setStatus(null)
  }, [selectedSection, activeContent, getDefaultSection])

  const handleSectionSelect = useCallback((section) => {
    setSelectedSection(section)
    setStatus(null)
  }, [])

  const handleEditorChange = useCallback((value) => {
    setEditorValue(value)
    try {
      const parsed = JSON.parse(value)
      setDraftContent(parsed)
      setJsonError(null)
    } catch (err) {
      setJsonError(err.message)
    }
  }, [])

  const handleReset = useCallback(() => {
    if (!originalContent) {
      return
    }
    const resetValue = cloneContent(originalContent)
    setDraftContent(resetValue)
    setEditorValue(JSON.stringify(resetValue, null, 2))
    setJsonError(null)
    setStatus(null)
  }, [originalContent])

  const handleBack = useCallback(() => {
    setSelectedSection(null)
    setOriginalContent(null)
    setDraftContent(null)
    setEditorValue('')
    setJsonError(null)
    setStatus(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedSection || !draftContent || jsonError) {
      return
    }

    setStatus(null)

    try {
      const response = await updateSection(selectedSection, draftContent)
      const updated = cloneContent(response?.content ?? draftContent)
      setOriginalContent(updated)
      setDraftContent(updated)
      setEditorValue(JSON.stringify(updated, null, 2))
      setStatus({ type: 'success', message: 'Inhalt erfolgreich gespeichert.' })
    } catch (err) {
      setStatus({ type: 'error', message: err?.message || 'Speichern fehlgeschlagen.' })
    }
  }, [draftContent, jsonError, selectedSection, updateSection])

  const hasChanges = useMemo(() => {
    if (!selectedSection || !draftContent || !originalContent || jsonError) {
      return false
    }
    return JSON.stringify(draftContent) !== JSON.stringify(originalContent)
  }, [draftContent, jsonError, originalContent, selectedSection])

  const isSaving = selectedSection ? Boolean(savingSections?.[selectedSection]) : false

  const schemaHint = useMemo(() => {
    if (!selectedSection) {
      return ''
    }
    const base = getDefaultSection(selectedSection) ?? DEFAULT_CONTENT[selectedSection] ?? {}
    return JSON.stringify(base, null, 2)
  }, [getDefaultSection, selectedSection])

  const handleStructuredFieldChange = useCallback(
    (path, value) => {
      if (!selectedSection) {
        return
      }
      setDraftContent((prev) => {
        const fallback =
          getDefaultSection(selectedSection) ?? DEFAULT_CONTENT[selectedSection] ?? {}
        const base = cloneContent(prev ?? fallback)
        setNestedValue(base, path, value)
        setEditorValue(JSON.stringify(base, null, 2))
        setJsonError(null)
        return base
      })
    },
    [getDefaultSection, selectedSection],
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seiteninhalte verwalten</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Bearbeite Texte, Navigation und weitere statische Inhalte. Änderungen werden nach dem Speichern sofort aktiv.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshContent}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:border-primary-200 hover:text-primary-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Aktualisiere…' : 'Inhalte neu laden'}
        </button>
      </div>

      {error && !selectedSection && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <div>
            <p className="font-semibold">Fehler beim Laden der Inhalte</p>
            <p>{error?.message || String(error)}</p>
          </div>
        </div>
      )}

      {!selectedSection && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Wähle einen Inhaltsbereich aus:</p>
          <SectionPicker
            sections={sectionOptions}
            selected={selectedSection}
            onSelect={handleSectionSelect}
          />
        </div>
      )}

      {selectedSection && (
        <div className="space-y-6">
          <SectionToolbar
            onBack={handleBack}
            onReset={handleReset}
            onSave={handleSave}
            isSaving={isSaving}
            hasChanges={hasChanges}
          />

          {status && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                status.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              <AlertCircle className="h-4 w-4" />
              <span>{status.message}</span>
            </div>
          )}

          {selectedSection === 'hero' && (
            <HeroContentForm content={draftContent} onFieldChange={handleStructuredFieldChange} />
          )}
          {selectedSection === 'site_meta' && (
            <SiteMetaForm content={draftContent} onFieldChange={handleStructuredFieldChange} />
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ContentJsonEditor
              value={editorValue}
              onChange={handleEditorChange}
              error={jsonError}
              schemaHint={schemaHint}
            />
            <SectionPreview section={selectedSection} content={draftContent || {}} />
          </div>
        </div>
      )}
    </div>
  )
}

export default SiteContentEditor
