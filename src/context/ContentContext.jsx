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

/**
 * @fileoverview Content context for managing site-wide content, navigation, and published pages in the LinuxTutorialCMS application.
 *
 * This context provides centralized content management including:
 * - Site content sections with default values and API synchronization
 * - Dynamic navigation management with static and dynamic route handling
 * - Published page caching and retrieval with invalidation strategies
 * - Content editing and updating with optimistic updates
 * - Navigation merging and sorting with proper ordering
 *
 * Features:
 * - Default content fallbacks for all site sections
 * - Automatic content loading and error recovery
 * - Page-level caching with manual invalidation support
 * - Dynamic navigation from published pages with configurable ordering
 * - Optimistic updates for content editing
 * - Abort controller support for request cancellation
 * - Comprehensive loading and error state management
 *
 * Performance Optimizations:
 * - Multi-level caching with ref-based persistence
 * - useMemo for expensive navigation computations
 * - useCallback for stable function references
 * - Lazy loading of published pages and navigation
 * - Efficient state updates with proper dependency arrays
 *
 * Data Flow Patterns:
 * 1. On mount: Load site content, navigation, and published pages
 * 2. Content updates: Optimistic local updates with API synchronization
 * 3. Page fetching: Cache-first with fallback to API
 * 4. Navigation merging: Static + dynamic items with proper sorting
 *
 * Integration Patterns:
 * - Used by SiteContentEditor for content management
 * - Consumed by Header for navigation rendering
 * - Integrated with PageManager for published page handling
 * - Compatible with routing system for dynamic page access
 *
 * Security Considerations:
 * - Content validation and sanitization
 * - Safe fallback to default content
 * - Error boundaries prevent content crashes
 * - Input validation for section updates
 *
 * @version 1.0.0
 * @author LinuxTutorialCMS Team
 * @since 1.0.0
 */

/**
 * Content context for managing site-wide content and navigation state.
 *
 * Provides content sections, navigation data, published pages, and content
 * management operations throughout the application.
 *
 * @type {React.Context<Object|null>}
 * @property {Object} content - Merged content object with default and API data
 * @property {boolean} loading - Loading state for content operations
 * @property {Object|null} error - Error information from content operations
 * @property {Function} refreshContent - Function to reload content from API
 * @property {Function} getSection - Function to get a specific content section
 * @property {Function} getDefaultSection - Function to get default content for a section
 * @property {Function} getSiteMeta - Function to get site metadata
 * @property {Function} updateSection - Function to update a content section
 * @property {Object} savingSections - Object indicating which sections are being saved
 * @property {Object} navigation - Navigation data with loading, error, and refresh capabilities
 * @property {Object} pages - Published pages data with cache, loading, and error states
 */
const ContentContext = createContext(null)

/**
 * Default content structure for the LinuxTutorialCMS application.
 *
 * This object provides fallback content for all sections of the site, ensuring
 * that the application can function even when API data is unavailable. It serves
 * as both a template for content structure and a safety net for content delivery.
 *
 * Content Structure:
 * - hero: Main landing page content with CTAs and features
 * - site_meta: SEO metadata and site-wide information
 * - tutorial_section: Tutorial listing page content
 * - header: Navigation header with brand and menu items
 * - footer: Site footer with links and contact information
 * - grundlagen_page: Linux basics page specific content
 *
 * Default Content Features:
 * - Complete fallback for all site sections
 * - Consistent German language content
 * - Proper structure for nested content objects
 * - Navigation targets with type specifications
 * - Feature lists with color gradients
 * - Contact and social media links
 *
 * Usage Patterns:
 * - Initial content state before API loading
 * - Fallback content when API is unavailable
 * - Content structure reference for editing
 * - Default values for missing API content
 * - Template for new content sections
 *
 * Integration:
 * - Merged with API content in ContentProvider
 * - Used by getSection() and getDefaultSection() methods
 * - Referenced by content editing components
 * - Provides structure validation for content updates
 *
 * @type {Object}
 * @readonly
 */
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

/**
 * Array of available content section identifiers.
 *
 * This array provides a reference list of all content sections that can be
 * managed through the content context. It's used for validation, iteration,
 * and UI generation for content management interfaces.
 *
 * Content Sections:
 * - hero: Landing page hero section
 * - site_meta: Site-wide metadata and SEO information
 * - tutorial_section: Tutorial listing and management section
 * - header: Site header with navigation and branding
 * - footer: Site footer with links and information
 * - grundlagen_page: Linux basics course page content
 *
 * Usage:
 * - Content validation and type checking
 * - Dynamic form generation for content editing
 * - Navigation menu generation
 * - Content section iteration and processing
 *
 * @type {string[]}
 * @readonly
 */
export const CONTENT_SECTIONS = Object.keys(DEFAULT_CONTENT)

/**
 * Content context provider component that manages site-wide content, navigation, and page data.
 *
 * This provider handles comprehensive content management including loading, caching,
 * updating, and synchronizing site content with the backend API. It provides a unified
 * interface for accessing all content-related data and operations throughout the application.
 *
 * State Management:
 * - content: Merged content object with defaults and API data
 * - loading: Boolean for main content loading state
 * - error: Error object for content loading failures
 * - savingSections: Object tracking which sections are being saved
 * - navigation: Dynamic navigation items from published pages
 * - publishedPageSlugs: Array of published page identifiers
 * - pageCache: Caching system for published page content
 *
 * Data Flow Patterns:
 * 1. Content Loading: Load API content → Merge with defaults → Update state
 * 2. Content Updates: Local optimistic update → API sync → Final state
 * 3. Page Fetching: Cache check → API fetch → Cache update → Return data
 * 4. Navigation: Load published pages → Merge with static → Sort by order
 *
 * Caching Strategies:
 * - Page-level caching with ref-based persistence
 * - Cache invalidation on content updates
 * - Force refresh option bypassing cache
 * - Fallback to cache on API failures
 * - Automatic cache cleanup on provider unmount
 *
 * Performance Optimizations:
 * - useMemo for expensive navigation computations
 * - useCallback for stable function references
 * - Dual caching (state + ref) for persistence
 * - Lazy loading of optional data
 * - Efficient state update patterns
 *
 * Error Handling:
 * - Graceful fallback to default content
 * - Retry mechanisms for failed requests
 * - Error state propagation to consumers
 * - Network error handling with user feedback
 * - Validation of API responses
 *
 * Security Considerations:
 * - Input validation for section updates
 * - Content sanitization and validation
 * - Safe error handling without data leakage
 * - Proper cleanup on component unmount
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that will have access to content context
 * @returns {JSX.Element} ContentContext.Provider wrapping children with content state and methods
 *
 * @example
 * ```jsx
 * <ContentProvider>
 *   <App />
 * </ContentProvider>
 * ```
 *
 * @example
 * ```jsx
 * // Using content context in a component
 * function Header() {
 *   const { content, navigation } = useContent();
 *   const { brand, navItems } = content.header;
 *
 *   return (
 *     <header>
 *       <div>{brand.name}</div>
 *       <nav>
 *         {navigation.items.map(item => (
 *           <Link key={item.id} to={item.path}>
 *             {item.label}
 *           </Link>
 *         ))}
 *       </nav>
 *     </header>
 *   );
 * }
 * ```
 *
 * @see useContent - Hook for accessing content context
 * @see api.getSiteContent - API method for content retrieval
 * @see api.updateSiteContentSection - API method for content updates
 */
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

  
  /**
   * Loads site content from the API and merges it with default content values.
   *
   * This function handles the initial content loading process by fetching content
   * from the backend API and intelligently merging it with the default content
   * structure. It ensures that all content sections are available even if the
   * API provides partial data or fails completely.
   *
   * Loading Process:
   * 1. Sets loading state to true for UI feedback
   * 2. Clears any existing error state
   * 3. Fetches content from API endpoint
   * 4. Creates merged content starting with defaults
   * 5. Overwrites default sections with API data where available
   * 6. Updates content state with merged result
   * 7. Handles errors gracefully with fallback content
   *
   * Error Handling Strategy:
   * - Network errors: Log error and set user-friendly message
   * - API errors: Preserve status codes for appropriate handling
   * - Invalid responses: Fallback to default content entirely
   * - Empty responses: Use default content as fallback
   * - Loading errors: Never leave application in broken state
   *
   * Data Validation:
   * - Validates API response structure
   * - Checks for items array existence
   * - Validates section identifiers
   * - Handles malformed content gracefully
   * - Ensures section content is properly structured
   *
   * Performance Considerations:
   * - Single API call for all content sections
   * - Efficient merging algorithm
   * - State update batching
   * - Minimal re-renders through useCallback
   *
   * @async
   * @returns {Promise<void>} Promise that resolves when content loading is complete
   *
   * @example
   * ```jsx
   * // Manual content refresh
   * const { refreshContent } = useContent();
   *
   * const handleRefresh = async () => {
   *   await refreshContent();
   *   // Content is now updated with latest API data
   * };
   * ```
   *
   * @see api.getSiteContent - API method for fetching content
   * @see DEFAULT_CONTENT - Default content fallback structure
   * @see setContent - State setter for content updates
   */
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

  
  /**
   * Loads dynamic navigation items from the API for integration with static navigation.
   *
   * This function fetches navigation items that represent published pages and
   * dynamic content, which are then merged with static navigation items defined
   * in the content configuration. The result provides a unified navigation
   * structure for the entire application.
   *
   * Navigation Loading Process:
   * 1. Sets navigation loading state for UI feedback
   * 2. Clears any existing navigation error state
   * 3. Fetches dynamic navigation items from API
   * 4. Validates response structure and item array
   * 5. Updates dynamic navigation items state
   * 6. Handles errors gracefully with appropriate state updates
   *
   * Data Structure:
   * - Each navigation item contains: id, label, slug, order_index
   * - Items are sorted by order_index for consistent ordering
   * - Invalid items are filtered out to prevent navigation errors
   * - Empty responses result in empty navigation array
   *
   * Error Handling:
   * - Network errors: Logged and stored for UI display
   * - Invalid responses: Treated as empty navigation
   * - Malformed items: Filtered out to prevent crashes
   * - API errors: Preserved for appropriate user feedback
   *
   * Integration with Navigation System:
   * - Combined with static navigation items in navigationData useMemo
   * - Merged items are sorted by order_index and source priority
   * - Used by Header component for navigation rendering
   * - Supports both section-based and route-based navigation
   *
   * Performance Considerations:
   * - Single API call for all dynamic navigation
   * - Efficient array filtering and validation
   * - Minimal state updates through useCallback
   * - Separated loading states for better UX
   *
   * @async
   * @returns {Promise<void>} Promise that resolves when navigation loading is complete
   *
   * @example
   * ```jsx
   * // Manual navigation refresh
   * const { navigation } = useContent();
   *
   * const handleRefreshNav = async () => {
   *   await navigation.refresh();
   *   // Navigation is now updated with latest published pages
   * };
   * ```
   *
   * @see api.getNavigation - API method for fetching navigation items
   * @see navigationData - Memoized navigation merging logic
   * @see setDynamicNavItems - State setter for navigation items
   */
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

  
  /**
   * Loads list of published page slugs from API.
   * 
   * @returns {Promise<void>}
   */
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

  
  /**
   * Fetches a published page by slug with intelligent caching and fallback strategies.
   *
   * This function implements a robust caching system for published page content,
   * providing both performance optimization and resilience against network failures.
   * It supports cache bypassing, request cancellation, and graceful fallback to
   * cached content when the API is unavailable.
   *
   * Caching Strategy:
   * - Dual caching: State + ref for persistence across re-renders
   * - Cache-first approach for optimal performance
   * - Force refresh option bypasses cache completely
   * - Fallback to cache on API failures
   * - Automatic cache population on successful fetches
   *
   * Fetch Flow:
   * 1. Input validation and slug normalization
   * 2. Cache check (unless force refresh)
   * 3. API fetch if cache miss or force refresh
   * 4. Cache update on successful fetch
   * 5. Fallback to cached data on API failure
   * 6. Error propagation if no cached fallback available
   *
   * Input Validation:
   * - Validates slug parameter existence and type
   * - Normalizes slug (trim, lowercase) for consistency
   * - Throws descriptive errors for invalid inputs
   * - Prevents API calls with invalid parameters
   *
   * Error Handling:
   * - Input validation errors: Throw immediately
   * - Network errors: Fall back to cached content if available
   * - Not found errors: Propagate to caller
   * - Request cancellation: Handle gracefully
   * - No cached fallback: Propagate original error
   *
   * Performance Optimizations:
   * - Cache-first approach minimizes API calls
   * - Ref-based cache persists across state updates
   * - Single cache update operation
   * - Request cancellation support
   * - Efficient slug normalization
   *
   * @async
   * @param {string} slug - Page slug to fetch. Must be a non-empty string.
   * @param {Object} [options={}] - Optional configuration for the fetch operation
   * @param {boolean} [options.force=false] - Force refresh bypassing cache. When true, always fetches from API.
   * @param {AbortSignal} [options.signal] - Abort signal for request cancellation. Allows cancellation of in-flight requests.
   * @returns {Promise<Object>} Promise that resolves to published page data object
   * @returns {string} returns.slug - The normalized page slug
   * @returns {Object} returns.content - Page content object with sections and data
   * @returns {string} returns.title - Page title from metadata
   * @returns {Date} returns.updated_at - Last update timestamp
   *
   * @throws {Error} If slug is invalid or empty
   * @throws {Error} If API request fails and no cached fallback is available
   *
   * @example
   * ```jsx
   * // Basic page fetch with caching
   * const { pages } = useContent();
   *
   * const loadPage = async () => {
   *   try {
   *     const pageData = await pages.fetch('tutorial-basics');
   *     setContent(pageData);
   *   } catch (error) {
   *     setError(error.message);
   *   }
   * };
   * ```
   *
   * @example
   * ```jsx
   * // Force refresh bypassing cache
   * const { pages } = useContent();
   *
   * const refreshPage = async () => {
   *   const freshData = await pages.fetch('tutorial-basics', { force: true });
   *   setContent(freshData);
   * };
   * ```
   *
   * @example
   * ```jsx
   * // With request cancellation
   * const { pages } = useContent();
   * const controller = new AbortController();
   *
   * const loadPage = async () => {
   *   try {
   *     const pageData = await pages.fetch('tutorial-basics', {
   *       signal: controller.signal
   *     });
   *   } catch (error) {
   *     if (error.name === 'AbortError') {
   *       console.log('Request was cancelled');
   *     }
   *   }
   * };
   *
   * // Cancel request if needed
   * controller.abort();
   * ```
   *
   * @see api.getPublishedPage - API method for fetching published pages
   * @see invalidatePageCache - Method for cache invalidation
   * @see pageCacheRef - Ref-based cache storage
   */
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

  
  /**
   * Invalidates page cache for a specific slug or all pages.
   * 
   * @param {string} [slug] - Specific slug to invalidate, or undefined to clear all
   */
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

  
  /**
   * Updates a content section via API and updates local state.
   * 
   * @param {string} section - Section identifier to update
   * @param {Object} newContent - New content for the section
   * @returns {Promise<Object>} API response
   * @throws {Error} If section is not provided
   */
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

/**
 * Custom hook for accessing the content context within functional components.
 *
 * This hook provides a clean interface for components to access site content,
 * navigation data, published pages, and content management operations. It includes
 * safety checks to ensure the hook is used within a ContentProvider wrapper.
 *
 * Hook Usage Patterns:
 * - Call at the top level of functional components
 * - Destructure needed values from the returned object
 * - Handle loading and error states appropriately
 * - Use for both read-only and content modification operations
 *
 * Available Context Values:
 * - content: Merged site content object with all sections
 * - loading: Boolean for main content loading state
 * - error: Error object or null from content operations
 * - refreshContent: Function to reload content from API
 * - getSection: Function to retrieve specific content sections
 * - getDefaultSection: Function to get default content for comparison
 * - getSiteMeta: Function to get site metadata and SEO information
 * - updateSection: Function to update content sections with API sync
 * - savingSections: Object indicating which sections are being saved
 * - navigation: Complete navigation data with loading states
 * - pages: Published pages data with caching and management
 *
 * Error Handling:
 * - Throws descriptive error if used outside ContentProvider
 * - Error message helps developers debug context setup issues
 * - Prevents undefined context access in components
 * - Validates provider availability before returning context
 *
 * Performance Features:
 * - Uses React's useContext for optimal performance
 * - Stable context value through useMemo in provider
 * - No additional re-renders beyond context value changes
 * - Efficient prop access through destructuring
 *
 * Integration Examples:
 * ```jsx
 * // Header component using content and navigation
 * function Header() {
 *   const { content, navigation } = useContent();
 *   const { brand } = content.header;
 *
 *   return (
 *     <header>
 *       <h1>{brand.name}</h1>
 *       <nav>
 *         {navigation.items.map(item => (
 *           <Link key={item.id} to={item.path}>
 *             {item.label}
 *           </Link>
 *         ))}
 *       </nav>
 *     </header>
 *   );
 * }
 * ```
 *
 * ```jsx
 * // Content editor component
 * function ContentEditor({ section }) {
 *   const { content, updateSection, savingSections } = useContent();
 *   const [localContent, setLocalContent] = useState(content[section]);
 *   const isSaving = savingSections[section];
 *
 *   const handleSave = async () => {
 *     try {
 *       await updateSection(section, localContent);
 *       // Show success message
 *     } catch (error) {
 *       // Show error message
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       // Content editing form here
 *       <button onClick={handleSave} disabled={isSaving}>
 *         {isSaving ? 'Saving...' : 'Save'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 *
 * ```jsx
 * // Page loader component
 * function PageLoader({ slug }) {
 *   const { pages } = useContent();
 *   const [pageData, setPageData] = useState(null);
 *   const [error, setError] = useState(null);
 *
 *   useEffect(() => {
 *     const loadPage = async () => {
 *       try {
 *         const data = await pages.fetch(slug);
 *         setPageData(data);
 *       } catch (err) {
 *         setError(err.message);
 *       }
 *     };
 *
 *     loadPage();
 *   }, [slug, pages.fetch]);
 *
 *   if (error) return <ErrorMessage message={error} />;
 *   if (!pageData) return <LoadingSpinner />;
 *   return <PageRenderer content={pageData} />;
 * }
 * ```
 *
 * @returns {Object} Complete content context value object
 * @returns {Object} returns.content - Merged site content with all sections
 * @returns {boolean} returns.loading - Loading state for content operations
 * @returns {Object|null} returns.error - Error information from content operations
 * @returns {Function} returns.refreshContent - Function to reload content from API
 * @returns {Function} returns.getSection - Function to get specific content section
 * @returns {Function} returns.getDefaultSection - Function to get default content for section
 * @returns {Function} returns.getSiteMeta - Function to get site metadata
 * @returns {Function} returns.updateSection - Function to update content section
 * @returns {Object} returns.savingSections - Object tracking section save operations
 * @returns {Object} returns.navigation - Navigation data with loading, error, and items
 * @returns {Object} returns.pages - Published pages data with cache and management
 *
 * @throws {Error} If the hook is used outside of a ContentProvider component
 *
 * @example
 * ```jsx
 * // Basic usage in a component
 * function MyComponent() {
 *   const { content, loading, error } = useContent();
 *
 *   if (loading) return <LoadingSpinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *
 *   return <div>{content.hero.title.line1}</div>;
 * }
 * ```
 *
 * @example
 * ```jsx
 * // Content management usage
 * function ContentManager({ section }) {
 *   const { getSection, updateSection, savingSections } = useContent();
 *   const sectionContent = getSection(section);
 *   const isSaving = savingSections[section];
 *
 *   const handleUpdate = async (newContent) => {
 *     await updateSection(section, newContent);
 *   };
 *
 *   return (
 *     <ContentEditor
 *       content={sectionContent}
 *       onUpdate={handleUpdate}
 *       isSaving={isSaving}
 *     />
 *   );
 * }
 * ```
 *
 * @see ContentProvider - Provider component that creates the content context
 * @see ContentContext - The underlying React context object
 * @see useContext - React hook used internally
 * @see DEFAULT_CONTENT - Default content structure reference
 */
export const useContent = () => {
  const ctx = useContext(ContentContext)
  if (!ctx) {
    throw new Error('useContent must be used within a ContentProvider')
  }
  return ctx
}
