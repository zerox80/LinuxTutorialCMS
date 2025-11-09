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
    <div className="tutorial-card group cursor-pointer hover:-translate-y-2 animate-fade-in">
      {}
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-700 -z-10 blur-2xl`}></div>
      {}
      <div className="absolute inset-0 rounded-2xl overflow-hidden">
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 shimmer"></div>
      </div>
      {}
      <div className="relative mb-6">
        <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-2xl group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        <div className={`absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br ${color} rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center`}>
          <Sparkles className="w-3 h-3 text-white" />
        </div>
      </div>
      {}
      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-primary-700 transition-colors duration-300">{title}</h3>
      <p className="text-gray-600 mb-6 leading-relaxed line-clamp-2">{description}</p>
      {}
      <div className="space-y-3 mb-8">
        {topics.map((topic, index) => (
          <div 
            key={`${topic}-${index}`} 
            className="flex items-start text-sm text-gray-600 group/item hover:text-primary-600 transition-colors duration-200"
          >
            <div className={`mt-0.5 mr-3 w-5 h-5 rounded-full bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0 group-hover/item:scale-110 transition-transform duration-200`}>
              <ChevronRight className="w-3 h-3 text-white" />
            </div>
            <span className="flex-1">{topic}</span>
          </div>
        ))}
      </div>
      {}
      <button 
        type="button"
        onClick={handleSelect}
        className="relative w-full mt-auto py-3.5 px-6 bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 hover:text-white group-hover:shadow-2xl transition-all duration-300 flex items-center justify-center overflow-hidden group/button"
      >
        <span className="relative z-10 flex items-center gap-2">
          {buttonLabel || 'Zum Tutorial'}
          <ChevronRight className="w-5 h-5 group-hover/button:translate-x-1 transition-transform duration-300" />
        </span>
        {}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/button:translate-x-full transition-transform duration-1000"></div>
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
