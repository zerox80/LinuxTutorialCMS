import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Hero from '../components/Hero'
import TutorialSection from '../components/TutorialSection'
import { scrollToSection } from '../utils/scrollToSection'

/**
 * Renders the home page of the application.
 * It is composed of the `Hero` and `TutorialSection` components and handles
 * smooth scrolling to a specific section if directed by the navigation state.
 * @returns {JSX.Element} The rendered home page.
 */
const Home = () => {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const targetSection = location.state?.scrollTo
    if (!targetSection) {
      return
    }

    requestAnimationFrame(() => {
      scrollToSection(targetSection)
    })

    navigate(location.pathname, { replace: true, state: {} })
  }, [location, navigate])

  return (
    <>
      <Hero />
      <TutorialSection />
    </>
  )
}

export default Home
