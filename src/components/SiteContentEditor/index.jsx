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
}

const cloneContent = (value) => {
  if (value === undefined || value === null) {
    return {}
  }
  return JSON.parse(JSON.stringify(value))
}

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
      className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
    >
      <ArrowLeft className="h-4 w-4" />
      Zurück zur Auswahl
    </button>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
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
    <label className="block text-sm font-semibold text-gray-700">JSON-Inhalt</label>
    <textarea
      className="min-h-[420px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 font-mono text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
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
