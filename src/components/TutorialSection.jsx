import TutorialCard from './TutorialCard'
import { useTutorials } from '../context/TutorialContext'

const TutorialSection = () => {
  const { tutorials, getIconComponent } = useTutorials()

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="section-title">Tutorial Inhalte</h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          Umfassende Lernmodule für alle Erfahrungsstufen - vom Anfänger bis zum Profi
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {tutorials.map((tutorial) => (
          <TutorialCard 
            key={tutorial.id} 
            {...tutorial} 
            icon={getIconComponent(tutorial.icon)}
          />
        ))}
      </div>

      {/* Call to Action */}
      <div className="mt-16 bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 md:p-12 text-white text-center">
        <h3 className="text-3xl font-bold mb-4">Bereit anzufangen?</h3>
        <p className="text-xl text-primary-100 mb-6">
          Wähle ein Thema aus und starte deine Linux-Lernreise noch heute!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-8 py-3 bg-white text-primary-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200">
            Tutorial starten
          </button>
          <button className="px-8 py-3 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800 border-2 border-white/20 transition-colors duration-200">
            Mehr erfahren
          </button>
        </div>
      </div>
    </section>
  )
}

export default TutorialSection
