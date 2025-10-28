import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Hero from '../components/Hero'
import TutorialSection from '../components/TutorialSection'
import { scrollToSection } from '../utils/scrollToSection'

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
