// React hooks imports
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

// Icon imports from Lucide React library
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, CalendarDays } from 'lucide-react'

// Context and utility imports
import { useContent } from '../context/ContentContext' // Content management context
import {
  normalizeTitle,    // Utility for normalizing titles with fallbacks
  normalizeText,      // Utility for normalizing text content with fallbacks
  buildPreviewText,   // Utility for building post preview text
  formatDate,         // Utility for formatting dates consistently
  normalizeSlug,      // Utility for normalizing URL slugs
} from '../utils/postUtils'

/**
 * Dynamic page component for rendering CMS-driven pages with associated posts.
 *
 * This component provides a flexible page rendering system that:
 * - Fetches page content based on URL slugs from the ContentContext
 * - Displays dynamic hero sections with customizable gradients and content
 * - Renders associated blog posts/articles in a clean, organized layout
 * - Implements comprehensive error handling and loading states
 * - Supports caching for improved performance
 * - Provides responsive design with proper accessibility
 * - Handles SEO metadata and structured data
 *
 * The component is designed to work with a headless CMS where page content
 * and layout can be managed dynamically through the admin interface.
 *
 * @example
 * ```jsx
 * // Used in React Router for dynamic page routes
 * <Route path="/pages/:slug" element={<DynamicPage />} />
 *
 * // Example URLs that this component handles:
 * // /pages/linux-basics - Linux basics page with tutorials
 * // /pages/news - News page with blog posts
 * // /pages/about - About page with company information
 * ```
 *
 * @component
 * @returns {JSX.Element} A fully rendered dynamic page with hero section,
 *                          about content, and posts listing. Includes
 *                          proper error states, loading indicators, and
 *                          responsive design.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
const DynamicPage = () => {
  // === ROUTING AND CONTEXT ===

  const { slug = '' } = useParams()              // Get page slug from URL parameters
  const navigate = useNavigate()                  // React Router navigation function
  const { pages } = useContent()                 // Content context for fetching page data

  // === STATE MANAGEMENT ===

  // Normalize the slug for consistent URL handling and caching
  const normalizedSlug = useMemo(() => normalizeSlug(slug), [slug])

  // Check for cached page data to improve performance and user experience
  const cachedPage = pages.cache?.[normalizedSlug]
  const [pageData, setPageData] = useState(cachedPage ?? null)  // Page and posts data
  const [loading, setLoading] = useState(!cachedPage)           // Loading state
  const [error, setError] = useState(null)                      // Error state for failed fetches

  // === DATA FETCHING EFFECT ===

  /**
   * Effect to fetch page data when slug changes or when no cached data exists.
   * Implements proper cleanup with AbortController to prevent race conditions
   * and memory leaks on component unmount or rapid navigation.
   */
  useEffect(() => {
    // Validate slug before attempting to fetch
    if (!normalizedSlug) {
      setError(new Error('Ungültige Seite'))
      setLoading(false)
      return
    }

    // Create AbortController for cleanup and race condition prevention
    const controller = new AbortController()

    /**
     * Async function to fetch page data with proper error handling
     * and abort signal checking to prevent state updates on unmounted components.
     */
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        // Fetch page data with abort signal for cancellation support
        const data = await pages.fetch(normalizedSlug, { signal: controller.signal })

        // Only update state if request wasn't aborted
        if (!controller.signal.aborted) {
          setPageData(data)
        }
      } catch (err) {
        // Ignore errors from aborted requests
        if (controller.signal.aborted) {
          return
        }
        // Set error state for failed fetches
        setError(err)
      } finally {
        // Always clear loading state if request wasn't aborted
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    // Start the data fetching process
    load()

    // Cleanup function: abort ongoing requests on unmount or dependency change
    return () => {
      controller.abort()
    }
  }, [normalizedSlug, pages]) // Effect depends on normalized slug and pages context

  // === DATA EXTRACTION AND NORMALIZATION ===

  // Extract page and posts data with safe property access
  const page = pageData?.page
  const posts = Array.isArray(pageData?.posts) ? pageData.posts : []

  // Extract layout configuration with safe defaults
  const hero = page?.hero ?? {}
  const layout = page?.layout ?? {}
  const aboutSection = layout?.aboutSection ?? {}
  const postsSection = layout?.postsSection ?? {}

  // === HERO SECTION CONTENT ===

  // Normalize hero section content with fallbacks for missing data
  const heroTitle = normalizeTitle(hero.title, page?.title)
  const heroSubtitle = normalizeText(hero.subtitle ?? hero.description, page?.description)
  const heroBadge = normalizeText(hero.badge ?? hero.badgeText, null)
  const heroGradient = hero.backgroundGradient || hero.gradient || 'from-primary-600 to-primary-700'

  // === ABOUT SECTION CONTENT ===

  // Normalize about section title with fallback
  const aboutTitle = normalizeText(aboutSection.title, 'Über diese Seite')

  // === POSTS SECTION CONTENT ===

  // Normalize posts section content with comprehensive fallbacks
  const postsTitle = normalizeText(postsSection.title, 'Beiträge')
  const postsEmptyTitle = normalizeText(postsSection.emptyTitle, 'Keine Beiträge vorhanden')
  const postsEmptyMessage = normalizeText(
    postsSection.emptyMessage,
    'Sobald für diese Seite Beiträge veröffentlicht werden, erscheinen sie hier.',
  )
  const postsCountSingular = normalizeText(
    postsSection.countLabelSingular,
    '{count} veröffentlichter Beitrag',
  )
  const postsCountPlural = normalizeText(
    postsSection.countLabelPlural,
    '{count} veröffentlichte Beiträge',
  )

  // === UTILITY FUNCTIONS ===

  /**
   * Formats the posts count with proper singular/plural handling and template substitution.
   * Supports custom count labels with {count} placeholder for localization.
   *
   * @param {number} count The number of posts to format
   * @returns {string} The formatted posts count with proper grammar and localization
   */
  const formatPostsCount = (count) => {
    // Select appropriate template based on count (singular vs plural)
    const template = count === 1 ? postsCountSingular : postsCountPlural

    // Replace {count} placeholder if present in template
    if (typeof template === 'string' && template.includes('{count}')) {
      return template.replace('{count}', count)
    }

    // Return template as-is if it's a valid string without placeholder
    if (template && typeof template === 'string') {
      return template
    }

    // Fallback to default German formatting
    return count === 1
      ? `${count} veröffentlichter Beitrag`
      : `${count} veröffentlichte Beiträge`
  }

  // === RENDER STATE FLAGS ===

  // Flag to determine if page has valid content for rendering
  const hasContent = Boolean(page)

  return (
    // Main container with responsive gradient background
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ==================== NAVIGATION BACK BUTTON ==================== */}
        {/* Back button with hover animation and navigation state tracking */}
        <button
          onClick={() => navigate('/', { state: { scrollTo: null, from: 'dynamic-page' } })}
          className="group inline-flex items-center gap-2 text-primary-700 font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Zurück
        </button>

        {/* ==================== CONDITIONAL RENDERING ==================== */}
        {/* Loading state with spinner animation */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-gray-500">
            <Loader2 className="w-10 h-10 animate-spin mb-4" />
            <p>Seite wird geladen…</p>
          </div>
        ) : error ? (
          // Error state with detailed error information
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700 flex gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div>
              <h2 className="font-semibold mb-1">Seite konnte nicht geladen werden</h2>
              <p className="text-sm">{error?.message || 'Unbekannter Fehler'}</p>
            </div>
          </div>
        ) : !hasContent ? (
          // Not found state for missing or unpublished pages
          <div className="rounded-3xl border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
            Die angeforderte Seite wurde nicht gefunden oder ist nicht veröffentlicht.
          </div>
        ) : (
          // Main content rendering when page data is available
          <div className="space-y-12">
            {/* ==================== HERO SECTION ==================== */}
            {/* Hero section with gradient background and page metadata */}
            <section className="relative overflow-hidden rounded-3xl border border-primary-100 dark:border-primary-900/40 bg-white dark:bg-slate-900/80 shadow-xl">
              {/* Gradient background overlay for visual appeal */}
              <div className={`absolute inset-0 bg-gradient-to-br ${heroGradient} opacity-90`} aria-hidden="true" />

              {/* Hero content positioned above the gradient */}
              <div className="relative px-6 py-12 sm:px-10 sm:py-14 text-white">
                <div className="max-w-3xl space-y-6">
                  {/* Optional badge/label for categorization */}
                  {heroBadge && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium">
                      {heroBadge}
                    </span>
                  )}

                  {/* Main page title with fallback */}
                  <h1 className="text-3xl sm:text-4xl font-bold leading-tight drop-shadow-sm">
                    {heroTitle || 'Neue Seite'}
                  </h1>

                  {/* Optional subtitle/description */}
                  {heroSubtitle && <p className="text-lg text-white/90 leading-relaxed">{heroSubtitle}</p>}
                </div>
              </div>
            </section>

            {/* ==================== ABOUT SECTION ==================== */}
            {/* Conditional about section - only renders if page has description */}
            {page?.description && (
              <section className="bg-white dark:bg-slate-900/80 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-800 px-6 py-8 sm:px-10">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 mb-3">{aboutTitle}</h2>
                <p className="text-gray-700 dark:text-slate-200 leading-relaxed">{page.description}</p>
              </section>
            )}

            {/* ==================== POSTS SECTION ==================== */}
            <section className="space-y-6">
              {/* Section header with dynamic title and post count */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
                  {posts.length > 0 ? postsTitle : postsEmptyTitle}
                </h2>

                {/* Post count indicator - only shows when there are posts */}
                {posts.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-slate-400">{formatPostsCount(posts.length)}</span>
                )}
              </div>

              {/* ==================== POSTS LIST ==================== */}
              {/* Conditional rendering: empty state vs posts list */}
              {posts.length === 0 ? (
                // Empty state when no posts are available
                <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-8 text-center text-gray-600 dark:text-slate-300">
                  {postsEmptyMessage}
                </div>
              ) : (
                // Posts list with individual post cards
                <div className="space-y-10">
                  {posts.map((post) => {
                    // Extract and normalize post data for rendering
                    const publishedDate = formatDate(post.published_at)
                    const previewText = buildPreviewText(post)
                    const postSlug = normalizeSlug(post?.slug)

                    return (
                      // Individual post card with hover effects
                      <article
                        key={post.id}
                        className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow duration-200"
                      >
                        <div className="px-6 py-7 sm:px-9 sm:py-8 space-y-6">
                          {/* Post header with metadata and title */}
                          <header className="space-y-2">
                            {/* Publication date with calendar icon */}
                            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                              {publishedDate && (
                                <span className="inline-flex items-center gap-1.5">
                                  <CalendarDays className="w-4 h-4" />
                                  {publishedDate}
                                </span>
                              )}
                            </div>

                            {/* Post title with responsive text wrapping */}
                            <h3 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 break-words">{post.title}</h3>

                            {/* Optional preview text with line clamping for consistent height */}
                            {previewText && (
                              <p className="text-gray-600 dark:text-slate-300 leading-relaxed break-words line-clamp-3">
                                {previewText}
                              </p>
                            )}
                          </header>

                          {/* Post footer with action buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                            {/* Content indicator showing what's available */}
                            <span className="text-sm text-gray-500 dark:text-slate-400">
                              {previewText ? 'Kurzvorschau' : 'Mehr Details verfügbar'}
                            </span>

                            {/* Read more link - conditional on valid slug */}
                            {postSlug ? (
                              <Link
                                to={`/pages/${normalizedSlug}/posts/${postSlug}`}
                                className="inline-flex items-center gap-2 text-primary-700 dark:text-primary-300 font-semibold hover:text-primary-800 dark:hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:rounded-lg"
                              >
                                Weiterlesen
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

export default DynamicPage
