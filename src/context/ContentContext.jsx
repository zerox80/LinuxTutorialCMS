import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import { api } from '../api/client'

const ContentContext = createContext(null)

export const DEFAULT_CONTENT = {
  hero: {
    badgeText: 'Professionelles Linux Training',
    icon: 'Terminal',
    title: {
      line1: 'Lerne Linux',
      line2: 'von Grund auf',
    },
    subtitle: 'Dein umfassendes Tutorial für Linux – von den Basics bis zu Advanced-Techniken.',
    subline: 'Interaktiv, modern und praxisnah.',
    primaryCta: {
      label: "Los geht's",
      target: { type: 'section', value: 'tutorials' },
    },
    secondaryCta: {
      label: 'Mehr erfahren',
      target: { type: 'section', value: 'tutorials' },
    },
    features: [
      {
        icon: 'Book',
        title: 'Schritt für Schritt',
        description: 'Strukturiert lernen mit klaren Beispielen',
        color: 'from-blue-500 to-cyan-500',
      },
      {
        icon: 'Code',
        title: 'Praktische Befehle',
        description: 'Direkt anwendbare Kommandos',
        color: 'from-purple-500 to-pink-500',
      },
      {
        icon: 'Zap',
        title: 'Modern & Aktuell',
        description: 'Neueste Best Practices',
        color: 'from-orange-500 to-red-500',
      },
    ],
  },
  site_meta: {
    title: 'Linux Tutorial - Lerne Linux Schritt für Schritt',
    description: 'Lerne Linux von Grund auf - Interaktiv, modern und praxisnah.',
  },
  tutorial_section: {
    title: 'Tutorial Inhalte',
    description: 'Umfassende Lernmodule für alle Erfahrungsstufen – vom Anfänger bis zum Profi',
    heading: 'Bereit anzufangen?',
    ctaDescription: 'Wähle ein Thema aus und starte deine Linux-Lernreise noch heute!',
    ctaPrimary: {
      label: 'Tutorial starten',
      target: { type: 'section', value: 'home' },
    },
    ctaSecondary: {
      label: 'Mehr erfahren',
      target: { type: 'section', value: 'home' },
    },
    tutorialCardButton: 'Zum Tutorial',
  },
  header: {
    brand: {
      name: 'Linux Tutorial',
      tagline: '',
      icon: 'Terminal',
    },
    navItems: [
      { id: 'home', label: 'Home', type: 'section' },
      { id: 'grundlagen', label: 'Grundlagen', type: 'route', path: '/grundlagen' },
    ],
    cta: {
      guestLabel: 'Login',
      authLabel: 'Admin',
      icon: 'Lock',
    },
  },
  footer: {
    brand: {
      title: 'Linux Tutorial',
      description: 'Dein umfassendes Tutorial für Linux – von den Basics bis zu Advanced-Techniken.',
      icon: 'Terminal',
    },
    quickLinks: [
      { label: 'Grundlagen', target: { type: 'section', value: 'grundlagen' } },
      { label: 'Befehle', target: { type: 'section', value: 'befehle' } },
      { label: 'Praxis', target: { type: 'section', value: 'praxis' } },
      { label: 'Advanced', target: { type: 'section', value: 'advanced' } },
    ],
    contactLinks: [
      { label: 'GitHub', href: 'https://github.com', icon: 'Github' },
      { label: 'E-Mail', href: 'mailto:info@example.com', icon: 'Mail' },
    ],
    bottom: {
      copyright: '© {year} Linux Tutorial. Alle Rechte vorbehalten.',
      signature: 'Gemacht mit Herz für die Linux Community',
    },
  },
  grundlagen_page: {
    hero: {
      badge: 'Grundlagenkurs',
      title: 'Starte deine Linux-Reise mit einem starken Fundament',
      description:
        'In diesem Grundlagenbereich begleiten wir dich von den allerersten Schritten im Terminal bis hin zu sicheren Arbeitsabläufen. Nach diesem Kurs bewegst du dich selbstbewusst in der Linux-Welt.',
      icon: 'BookOpen',
    },
    highlights: [
      {
        icon: 'BookOpen',
        title: 'Terminal Basics verstehen',
        description:
          'Lerne die wichtigsten Shell-Befehle, arbeite sicher mit Dateien und nutze Pipes, um Aufgaben zu automatisieren.',
      },
      {
        icon: 'Compass',
        title: 'Linux-Philosophie kennenlernen',
        description:
          'Verstehe das Zusammenspiel von Kernel, Distribution, Paketverwaltung und warum Linux so flexibel einsetzbar ist.',
      },
      {
        icon: 'Layers',
        title: 'Praxisnahe Übungen',
        description:
          'Setze das Erlernte direkt in kleinen Projekten um – von der Benutzerverwaltung bis zum Einrichten eines Webservers.',
      },
      {
        icon: 'ShieldCheck',
        title: 'Sicher arbeiten',
        description:
          'Erhalte Best Practices für Benutzerrechte, sudo, SSH und weitere Sicherheitsmechanismen.',
      },
    ],
    modules: {
      title: 'Module im Grundlagenkurs',
      description:
        'Unsere Tutorials bauen logisch aufeinander auf. Jedes Modul enthält praxisnahe Beispiele, Schritt-für-Schritt Anleitungen und kleine Wissenschecks, damit du deinen Fortschritt direkt sehen kannst.',
      items: [
        'Einstieg in die Shell: Navigation, grundlegende Befehle, Dateiverwaltung',
        'Linux-Systemaufbau: Kernel, Distributionen, Paketmanager verstehen und nutzen',
        'Benutzer & Rechte: Arbeiten mit sudo, Gruppen und Dateiberechtigungen',
        'Wichtige Tools: SSH, einfache Netzwerkanalyse und nützliche Utilities für den Alltag',
      ],
      summary: [
        'Über 40 praxisnahe Lessons',
        'Schritt-für-Schritt-Guides mit Screenshots & Code-Beispielen',
        'Übungen und Checklisten zum Selbstüberprüfen',
      ],
    },
    cta: {
      title: 'Bereit für den nächsten Schritt?',
      description:
        'Wechsel zur Startseite und wähle das Modul, das am besten zu dir passt, oder tauche direkt in die Praxis- und Advanced-Themen ein, sobald du die Grundlagen sicher beherrschst.',
      primary: { label: 'Zur Startseite', href: '/' },
      secondary: { label: 'Tutorials verwalten', href: '/admin' },
    },
  },
}

export const CONTENT_SECTIONS = Object.keys(DEFAULT_CONTENT)

export const ContentProvider = ({ children }) => {
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingSections, setSavingSections] = useState({})
  const [navLoading, setNavLoading] = useState(true)
  const [navError, setNavError] = useState(null)
  const [dynamicNavItems, setDynamicNavItems] = useState([])
  const [publishedPageSlugs, setPublishedPageSlugs] = useState([])
  const [publishedPagesLoading, setPublishedPagesLoading] = useState(true)
  const [publishedPagesError, setPublishedPagesError] = useState(null)
  const [pageCache, setPageCache] = useState({})
  const pageCacheRef = useRef({})

  
  const loadContent = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getSiteContent()
      const merged = { ...DEFAULT_CONTENT }

      if (data?.items?.length) {
        for (const item of data.items) {
          merged[item.section] = item.content
        }
      }

      setContent(merged)
    } catch (err) {
      console.error('Failed to load site content:', err)
      const fallback = err?.status ? err : new Error('Inhalte konnten nicht geladen werden.')
      fallback.status = err?.status ?? 500
      setError(fallback)
    } finally {
      setLoading(false)
    }
  }, [])

  
  const loadNavigation = useCallback(async () => {
    try {
      setNavLoading(true)
      setNavError(null)
      const data = await api.getNavigation()
      const items = Array.isArray(data?.items) ? data.items : []
      setDynamicNavItems(items)
    } catch (err) {
      console.error('Failed to load dynamic navigation:', err)
      setNavError(err)
    } finally {
      setNavLoading(false)
    }
  }, [])

  
  const loadPublishedPages = useCallback(async () => {
    try {
      setPublishedPagesLoading(true)
      setPublishedPagesError(null)
      const data = await api.listPublishedPages()
      const items = Array.isArray(data) ? data : []
      setPublishedPageSlugs(items)
    } catch (err) {
      console.error('Failed to load published pages:', err)
      setPublishedPagesError(err)
    } finally {
      setPublishedPagesLoading(false)
    }
  }, [])

  
  const fetchPublishedPage = useCallback(
    async (slug, { force = false, signal } = {}) => {
      if (!slug || typeof slug !== 'string') {
        throw new Error('Slug is required')
      }

      const normalizedSlug = slug.trim().toLowerCase()
      if (!normalizedSlug) {
        throw new Error('Slug is required')
      }

      if (!force && pageCacheRef.current[normalizedSlug]) {
        return pageCacheRef.current[normalizedSlug]
      }

      try {
        const data = await api.getPublishedPage(normalizedSlug, { signal })
        const nextCache = { ...pageCacheRef.current, [normalizedSlug]: data }
        pageCacheRef.current = nextCache
        setPageCache(nextCache)
        return data
      } catch (err) {
        if (!force && pageCacheRef.current[normalizedSlug]) {
          return pageCacheRef.current[normalizedSlug]
        }
        throw err
      }
    },
    [],
  )

  
  const invalidatePageCache = useCallback((slug) => {
    if (slug && typeof slug === 'string') {
      const normalizedSlug = slug.trim().toLowerCase()
      if (!normalizedSlug) {
        return
      }

      setPageCache((prev) => {
        if (!prev[normalizedSlug]) {
          return prev
        }
        const next = { ...prev }
        delete next[normalizedSlug]
        pageCacheRef.current = next
        return next
      })
      return
    }

    pageCacheRef.current = {}
    setPageCache({})
  }, [])

  useEffect(() => {
    loadContent()
  }, [loadContent])

  useEffect(() => {
    loadNavigation()
    loadPublishedPages()
  }, [loadNavigation, loadPublishedPages])

  
  const updateSection = useCallback(async (section, newContent) => {
    if (!section) {
      throw new Error('Section is required')
    }

    setSavingSections((prev) => ({ ...prev, [section]: true }))

    try {
      const response = await api.updateSiteContentSection(section, newContent)
      const updatedContent = response?.content ?? newContent
      setContent((prev) => ({
        ...prev,
        [section]: updatedContent,
      }))
      return response
    } finally {
      setSavingSections((prev) => {
        const next = { ...prev }
        delete next[section]
        return next
      })
    }
  }, [])

  const navigationData = useMemo(() => {
    const headerContent = content?.header ?? DEFAULT_CONTENT.header
    const staticNavItems = Array.isArray(headerContent?.navItems) ? headerContent.navItems : []

    const staticNormalized = staticNavItems.map((item, index) => ({
      ...item,
      id: item.id || item.slug || item.path || `static-${index}`,
      source: item.source || 'static',
    }))

    const filteredDynamic = Array.isArray(dynamicNavItems)
      ? dynamicNavItems.filter((item) => item && item.slug)
      : []
    const sortedDynamic = [...filteredDynamic].sort(
      (a, b) => (a?.order_index ?? 0) - (b?.order_index ?? 0),
    )
    const dynamicNormalized = sortedDynamic.map((item, index) => ({
      id: item.id || `page-${item.slug}-${index}`,
      label: item.label || item.slug || 'Seite',
      type: 'route',
      path: `/pages/${item.slug}`,
      slug: item.slug,
      source: 'dynamic',
      order_index: item.order_index ?? index,
    }))

    return {
      static: staticNormalized,
      dynamic: dynamicNormalized,
      items: [...staticNormalized, ...dynamicNormalized],
    }
  }, [content, dynamicNavItems])

  const value = useMemo(() => ({
    content,
    loading,
    error,
    refreshContent: loadContent,
    getSection: (section) => content[section] ?? DEFAULT_CONTENT[section],
    getDefaultSection: (section) => DEFAULT_CONTENT[section],
    getSiteMeta: () => content?.site_meta ?? DEFAULT_CONTENT.site_meta,
    updateSection,
    savingSections,
    navigation: {
      ...navigationData,
      loading: navLoading,
      error: navError,
      refresh: loadNavigation,
    },
    pages: {
      cache: pageCache,
      fetch: fetchPublishedPage,
      publishedSlugs: publishedPageSlugs,
      loading: publishedPagesLoading,
      error: publishedPagesError,
      refresh: loadPublishedPages,
      invalidate: invalidatePageCache,
    },
  }), [
    content,
    loading,
    error,
    loadContent,
    updateSection,
    savingSections,
    navigationData,
    navLoading,
    navError,
    loadNavigation,
    pageCache,
    fetchPublishedPage,
    publishedPageSlugs,
    publishedPagesLoading,
    publishedPagesError,
    loadPublishedPages,
    invalidatePageCache,
  ]);

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};

ContentProvider.propTypes = {
  children: PropTypes.node,
}

export const useContent = () => {
  const ctx = useContext(ContentContext)
  if (!ctx) {
    throw new Error('useContent must be used within a ContentProvider')
  }
  return ctx
}
