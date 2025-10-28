import { useMemo } from 'react'
import TutorialCard from './TutorialCard'
import { useTutorials } from '../context/TutorialContext'
import { AlertCircle } from 'lucide-react'
import { scrollToSection } from '../utils/scrollToSection'

const TutorialSection = () => {
  const { tutorials, getIconComponent, loading, error } = useTutorials()

  // Memoize normalized tutorials to avoid recalculating on every render
  const normalizedTutorials = useMemo(() => {
    return tutorials.map((tutorial) => ({
      ...tutorial,
      topics: Array.isArray(tutorial.topics) ? tutorial.topics : [],
    }))
  }, [tutorials])

  return (
    <section
      className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
      data-section="tutorials"
      id="tutorials"
    >
      <div className="text-center mb-12">
        <h2 className="section-title">Tutorial Inhalte</h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Umfassende Lernmodule für alle Erfahrungsstufen - vom Anfänger bis zum Profi
        </p>
      </div>

      {error && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
          <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Fehler beim Laden der Tutorials</p>
            <p className="text-sm">{error?.message || String(error)}</p>
          </div>
        </div>
      )}

      {loading && normalizedTutorials.length === 0 ? (
        <div className="text-center text-gray-600 py-12">Lade Tutorials…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {normalizedTutorials.map((tutorial) => (
            <TutorialCard
              key={tutorial.id}
              {...tutorial}
              icon={getIconComponent(tutorial.icon)}
            />
          ))}
        </div>
      )}

      {/* Call to Action */}
      <div className="mt-16 bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 md:p-12 text-white text-center">
        <h3 className="text-3xl font-bold mb-4">Bereit anzufangen?</h3>
        <p className="text-xl text-primary-100 mb-6">
          Wähle ein Thema aus und starte deine Linux-Lernreise noch heute!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => scrollToSection('home')}
            className="px-8 py-3 bg-white text-primary-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200"
            aria-label="Tutorial starten und nach oben scrollen"
          >
            Tutorial starten
          </button>
          <button 
            onClick={() => scrollToSection('home')}
            className="px-8 py-3 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 border-2 border-white/20 transition-colors duration-200"
            aria-label="Mehr über die Tutorials erfahren"
          >
            Mehr erfahren
          </button>
        </div>
      </div>
    </section>
  )
}

export default TutorialSection
