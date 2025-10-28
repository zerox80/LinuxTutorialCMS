export const scrollToSection = (sectionId, behavior = 'smooth') => {
  if (typeof window === 'undefined') {
    return
  }

  if (!sectionId || typeof sectionId !== 'string') {
    return
  }

  if (sectionId === 'home') {
    window.scrollTo({ top: 0, behavior })
    return
  }

  const normalizedId = sectionId.trim().toLowerCase()

  const sectionMap = {
    grundlagen: 'tutorials',
    befehle: 'tutorials',
    praxis: 'tutorials',
    advanced: 'tutorials',
    tutorials: 'tutorials',
  }

  const targetIdentifier = sectionMap[normalizedId] || normalizedId
  const targetElement =
    document.querySelector(`[data-section="${targetIdentifier}"]`) ||
    document.getElementById(targetIdentifier)

  targetElement?.scrollIntoView({ behavior, block: 'start' })
}
