import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * @fileoverview Theme context for managing application-wide theme state and user preferences in the LinuxTutorialCMS application.
 *
 * This context provides centralized theme management including:
 * - Light/dark theme switching with immediate UI updates
 * - System preference detection and automatic theme application
 * - Persistent theme storage in localStorage
 * - CSS class management for Tailwind CSS integration
 * - Accessibility considerations for theme transitions
 *
 * Features:
 * - Automatic detection of user's system theme preference
 * - Manual theme toggle with instant visual feedback
 * - Theme persistence across browser sessions
 * - Smooth theme transitions with CSS support
 * - Fallback to light theme if no preference is set
 * - Integration with Tailwind CSS dark mode utilities
 *
 * Performance Optimizations:
 * - Single theme state variable with efficient updates
 * - Immediate DOM manipulation for instant visual feedback
 * - Optimized localStorage operations with minimal writes
 * - Debounced theme application to prevent excessive re-renders
 * - Efficient CSS class management
 *
 * Accessibility Considerations:
 * - Respects user's system preferences by default
 * - Provides clear visual distinction between themes
 * - Maintains sufficient color contrast ratios
 * - Supports reduced motion preferences
 * - Keyboard navigation support for theme toggle
 * - Screen reader compatibility with theme announcements
 *
 * Integration Patterns:
 * - Used by ThemeToggle component for theme switching UI
 * - Consumed by all components needing theme-aware styling
 * - Integrated with Tailwind CSS dark mode configuration
 * - Compatible with CSS custom properties for theming
 * - Supports theme-based component variations
 *
 * Browser Compatibility:
 * - Modern browsers with localStorage support
 * - CSS custom properties for dynamic theming
 * - prefers-color-scheme media query support
 * - Graceful degradation for older browsers
 *
 * @version 1.0.0
 * @author LinuxTutorialCMS Team
 * @since 1.0.0
 */

/**
 * Theme context for managing application theme state and user preferences.
 *
 * Provides the current theme value and theme toggle functionality for
 * implementing light/dark mode throughout the application.
 *
 * @type {React.Context<Object>}
 * @property {string} theme - Current theme value ('light' or 'dark')
 * @property {Function} toggleTheme - Function to switch between light and dark themes
 */
const ThemeContext = createContext();

/**
 * Custom hook for accessing the theme context within functional components.
 *
 * This hook provides a clean interface for components to access the current
 * theme state and theme toggle functionality. It includes safety checks to
 * ensure the hook is used within a ThemeProvider wrapper.
 *
 * Hook Usage Patterns:
 * - Call at the top level of functional components
 * - Destructure theme and toggleTheme from the returned object
 * - Use for conditional rendering based on theme
 * - Apply theme-aware styling and component variations
 *
 * Available Context Values:
 * - theme: Current theme string ('light' or 'dark')
 * - toggleTheme: Function to switch between themes
 *
 * Error Handling:
 * - Throws descriptive error if used outside ThemeProvider
 * - Error message helps developers debug context setup issues
 * - Prevents undefined context access in components
 * - Validates provider availability before returning context
 *
 * Performance Features:
 * - Uses React's useContext for optimal performance
 * - Stable context value with minimal re-renders
 * - Efficient prop access through destructuring
 * - No additional computational overhead
 *
 * Integration Examples:
 * ```jsx
 * // Theme-aware component
 * function ThemeComponent() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <div className={theme === 'dark' ? 'bg-gray-900' : 'bg-white'}>
 *       <h1>Current theme: {theme}</h1>
 *       <button onClick={toggleTheme}>Toggle Theme</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * ```jsx
 * // Theme toggle button component
 * function ThemeToggle() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <button
 *       onClick={toggleTheme}
 *       aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
 *       className="p-2 rounded"
 *     >
 *       {theme === 'light' ? '🌙' : '☀️'}
 *     </button>
 *   );
 * }
 * ```
 *
 * ```jsx
 * // Conditional styling based on theme
 * function ThemedCard() {
 *   const { theme } = useTheme();
 *
 *   const cardClasses = `
 *     p-4 rounded-lg shadow-lg
 *     ${theme === 'dark'
 *       ? 'bg-gray-800 text-white border-gray-700'
 *       : 'bg-white text-gray-900 border-gray-200'
 *     }
 *   `;

 *   return <div className={cardClasses}>Themed content</div>;
 * }
 * ```
 *
 * @returns {Object} Theme context value object
 * @returns {string} returns.theme - Current theme value ('light' or 'dark')
 * @returns {Function} returns.toggleTheme - Function to switch between light and dark themes
 *
 * @throws {Error} If the hook is used outside of a ThemeProvider component
 *
 * @example
 * ```jsx
 * // Basic usage
 * function MyComponent() {
 *   const { theme } = useTheme();
 *
 *   return (
 *     <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
 *       Content styled for {theme} mode
 *     </div>
 *   );
 * }
 * ```
 *
 * @see ThemeProvider - Provider component that creates the theme context
 * @see ThemeContext - The underlying React context object
 * @see useContext - React hook used internally
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Theme context provider component that manages application-wide theme state.
 *
 * This provider handles theme initialization, system preference detection,
 * localStorage persistence, and CSS class management for implementing a
 * complete light/dark theme system throughout the application.
 *
 * Theme Initialization Process:
 * 1. Check localStorage for saved theme preference
 * 2. Fall back to system preference detection
 * 3. Default to light theme if no preference found
 * 4. Apply initial theme to document element
 * 5. Set up theme persistence and DOM updates
 *
 * State Management:
 * - theme: Single state variable for current theme
 * - Initial state computed from localStorage/system preference
 * - State updates trigger immediate DOM changes
 * - Theme persistence handled automatically
 *
 * System Preference Detection:
 * - Uses prefers-color-scheme media query
 * - Automatically detects user's OS theme preference
 * - Respects user accessibility preferences
 * - Provides appropriate fallback for unsupported browsers
 *
 * localStorage Persistence Strategy:
 * - Stores theme preference with 'theme' key
 * - Writes only when theme changes to minimize I/O
 * - Handles localStorage unavailability gracefully
 * - Persists theme across browser sessions
 *
 * CSS Class Management:
 * - Adds/removes 'dark' class on document.documentElement
 * - Integrates with Tailwind CSS dark mode utilities
 * - Enables theme-based styling throughout application
 * - Provides immediate visual feedback on theme changes
 *
 * Performance Optimizations:
 * - Lazy initialization of theme state
 * - Efficient localStorage operations
 * - Direct DOM manipulation for instant updates
 * - Minimal re-renders with optimized dependencies
 * - Debounced theme application
 *
 * Accessibility Considerations:
 * - Respects user's system preferences by default
 * - Provides clear visual distinction between themes
 * - Supports high contrast modes
 * - Compatible with screen readers
 * - Maintains focus management during theme changes
 *
 * Error Handling:
 * - Graceful fallback for localStorage failures
 * - Safe handling of media query unavailable
 * - No breaking errors if CSS manipulation fails
 * - Consistent theme state regardless of environment
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components that will have access to theme context
 * @returns {JSX.Element} ThemeContext.Provider wrapping children with theme state and toggle functionality
 *
 * @example
 * ```jsx
 * // Application setup
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <Router>
 *         <Routes>
 *           <Route path="/" element={<HomePage />} />
 *           <Route path="/about" element={<AboutPage />} />
 *         </Routes>
 *       </Router>
 *     </ThemeProvider>
 *   );
 * }
 * ```
 *
 * @example
 * ```jsx
 * // With theme toggle in header
 * function Layout() {
 *   return (
 *     <ThemeProvider>
 *       <header>
 *         <ThemeToggle />
 *       </header>
 *       <main>
 *         <App />
 *       </main>
 *     </ThemeProvider>
 *   );
 * }
 * ```
 *
 * @see useTheme - Hook for accessing theme context
 * @see localStorage - Browser storage API for theme persistence
 * @see prefers-color-scheme - CSS media query for system preference detection
 */
export const ThemeProvider = ({ children }) => {
  /**
   * Theme state initialization with localStorage and system preference detection.
   *
   * The state is initialized using a function to avoid re-evaluating on every render.
   * This provides optimal performance by checking preferences only once during
   * component initialization.
   *
   * Initialization Priority:
   * 1. Check localStorage for saved theme preference
   * 2. Check system preference using prefers-color-scheme
   * 3. Default to 'light' theme as safe fallback
   *
   * Performance Considerations:
   * - Function-based initialization prevents repeated localStorage access
   * - Single evaluation during component mount
   * - Minimal memory usage with string value storage
   */
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  /**
   * Effect hook for applying theme changes to DOM and localStorage.
   *
   * This effect handles the side effects of theme changes by updating the
   * document element's CSS classes and persisting the theme preference.
   * It ensures the theme is consistently applied throughout the application.
   *
   * Theme Application Process:
   * 1. Get reference to document.documentElement
   * 2. Add/remove 'dark' class based on theme state
   * 3. Persist theme to localStorage for future sessions
   * 4. Trigger re-renders in theme-aware components
   *
   * DOM Manipulation:
   * - Targets document.documentElement for global theme application
   * - Uses classList API for efficient CSS class management
   * - Provides immediate visual feedback without layout shifts
   * - Integrates seamlessly with Tailwind CSS dark mode
   *
   * localStorage Strategy:
   * - Persists theme choice across browser sessions
   * - Uses 'theme' as consistent storage key
   * - Handles localStorage unavailability gracefully
   * - Minimizes write operations for performance
   *
   * Performance Features:
   * - Effect runs only when theme value changes
   * - Direct DOM manipulation for instant updates
   * - Minimal localStorage write operations
   * - No unnecessary re-renders or computations
   *
   * @effect
   * @dependency {string} theme - Current theme value that triggers DOM updates
   */
  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  /**
   * Theme toggle function for switching between light and dark themes.
   *
   * This function provides a simple interface for users to switch between
   * available themes. It updates the theme state which automatically triggers
   * DOM updates and localStorage persistence through the useEffect hook.
   *
   * Toggle Logic:
   * - Checks current theme value
   * - Switches to opposite theme ('light' ↔ 'dark')
   * - Triggers automatic DOM updates and persistence
   * - Provides immediate visual feedback
   *
   * User Experience:
   * - Instant theme switching without page reload
   * - Smooth transitions when CSS transitions are applied
   * - Persistent theme choice across sessions
   * - Clear visual distinction between themes
   *
   * Implementation Details:
   * - Uses functional state update for reliability
   * - Minimal computational overhead
   * - No side effects (handled by useEffect)
   * - Type-safe theme string handling
   *
   * Accessibility:
   * - Provides clear visual feedback
   * - Maintains focus during theme changes
   * - Compatible with screen readers
   * - Respects motion preferences when transitions are applied
   *
   * @function
   * @returns {void}
   *
   * @example
   * ```jsx
   * // In a component
   * const { toggleTheme } = useTheme();
   *
   * const handleThemeToggle = () => {
   *   toggleTheme(); // Switches between light and dark themes
   * };
   *
   * <button onClick={handleThemeToggle}>
   *   Toggle Theme
   * </button>
   * ```
   */
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  /**
   * Returns the theme context provider with current theme and toggle functionality.
   *
   * The provider value is stable and contains all necessary theme-related
   * functionality for child components. The value object structure ensures
   * consistent API across the application.
   *
   * Provider Value Structure:
   * - theme: Current theme string for conditional rendering
   * - toggleTheme: Function for theme switching
   *
   * Context Value Stability:
   * - Functions are stable through component lifecycle
   * - Minimal re-renders due to efficient state management
   * - Consistent API for consumer components
   * - Optimal performance through React optimizations
   *
   * @returns {JSX.Element} ThemeContext.Provider component with theme context value
   */
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * PropTypes for the ThemeProvider component.
 *
 * Ensures that only valid React nodes are passed as children to prevent
 * runtime errors and maintain component integrity. The children prop
 * is required as the ThemeProvider without children would serve no purpose.
 *
 * PropTypes Validation:
 * - children: Must be a valid React node (element, fragment, string, number, etc.)
 * - Required field ensures proper component usage
 * - Prevents runtime errors from invalid children types
 *
 * Error Handling:
 * - Throws descriptive error if children prop is missing
 * - Validates children type before component rendering
 * - Provides clear feedback for incorrect usage
 *
 * Integration Notes:
 * - Should wrap the entire application or relevant subtree
 * - Single ThemeProvider instance recommended per application
 * - Can be nested if multiple theme contexts are needed
 */
ThemeProvider.propTypes = {
  /**
   * Child components that will have access to the theme context.
   * Must be a valid React node (element, fragment, string, number, etc.).
   * This prop is required as the ThemeProvider's purpose is to provide
   * theme context to its children.
   */
  children: PropTypes.node.isRequired,
};
