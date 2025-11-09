import { ChevronRight, Sparkles } from 'lucide-react'
import PropTypes from 'prop-types'
import { scrollToSection } from '../utils/scrollToSection'
const TutorialCard = ({ icon: Icon, title, description, topics, color, onSelect, buttonLabel }) => {
  const handleSelect = () => {
    if (typeof onSelect === 'function') {
      onSelect()
      return
    }
    scrollToSection('tutorials')
  }
  return (
    <div
      className="tutorial-card group cursor-pointer hover:-translate-y-2 animate-fade-in"
      onClick={handleSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          handleSelect()
        }
      }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-10 rounded-2xl transition-opacity duration-700 -z-10 blur-2xl`}
        aria-hidden="true"
      ></div>
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 shimmer" aria-hidden="true"></div>
      </div>
      <div className="relative mb-6">
        <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div
          className={`absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br ${color} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center`}
          aria-hidden="true"
        >
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-bold text-neutral-900 mb-3 group-hover:text-primary-600 transition-colors duration-300">
        {title}
      </h3>
      <p className="text-neutral-500 mb-6 leading-relaxed line-clamp-2">{description}</p>
      <div className="space-y-3 mb-8">
        {topics.map((topic, index) => (
          <div
            key={`${topic}-${index}`}
            className="flex items-start text-sm text-neutral-500 group/item hover:text-primary-600 transition-colors duration-200"
          >
            <div className={`mt-0.5 mr-3 w-5 h-5 rounded-full bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform duration-200`}>
              <ChevronRight className="w-3 h-3 text-white" />
            </div>
            <span className="flex-1">{topic}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={handleSelect}
        className="relative w-full mt-auto py-3.5 px-6 rounded-xl font-semibold text-neutral-50 shadow-lg transition-all duration-300 flex items-center justify-center overflow-hidden group/button bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 hover:shadow-card-xl"
      >
        <span className="relative z-10 flex items-center gap-2">
          {buttonLabel || 'Zum Tutorial'}
          <ChevronRight className="w-5 h-5 group-hover/button:translate-x-1 transition-transform duration-300" />
        </span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/button:translate-x-full transition-transform duration-1000" aria-hidden="true"></div>
      </button>
    </div>
  )
}

TutorialCard.propTypes = {
  icon: PropTypes.elementType.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  topics: PropTypes.arrayOf(PropTypes.string).isRequired,
  color: PropTypes.string.isRequired,
  onSelect: PropTypes.func,
  buttonLabel: PropTypes.string,
}
export default TutorialCard
