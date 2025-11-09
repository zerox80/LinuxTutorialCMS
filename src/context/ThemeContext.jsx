import { createContext, useContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

/**
 * Custom hook for accessing theme management functionality throughout the application.
 *
 * This hook provides access to:
 * - Current theme state ('light' or 'dark')
 * - Theme toggle functionality
 * - Automatic system preference detection
 *
 * @example
 * ```jsx
 * // Theme toggle button component
 * function ThemeToggle() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {theme === 'dark' ? '🌙' : '☀️'} {theme}
 *     </button>
 *   );
 * }
 *
 * // Component that adapts to theme
 * function ThemedComponent() {
 *   const { theme } = useTheme();
 *
 *   return (
 *     <div className={theme === 'dark' ? 'dark-styles' : 'light-styles'}>
 *       Current theme: {theme}
 *     </div>
 *   );
 * }
 * ```
 *
 * @returns {object} Theme context value containing:
 *                  - theme {string}: Current theme ('light' | 'dark')
 *                  - toggleTheme {Function}: Function to toggle between themes
 *
 * @throws {Error} If used outside of a ThemeProvider wrapper component.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Theme management provider for handling light/dark mode functionality.
 *
 * This provider offers comprehensive theme management including:
 * - Automatic theme detection from system preferences
 * - Manual theme toggle functionality
 * - Persistent theme storage in localStorage
 * - Automatic CSS class application to root element
 * - Proper initialization sequence for SSR compatibility
 * - Respects user preferences and accessibility needs
 *
 * The provider integrates with Tailwind CSS dark mode classes and provides
 * a seamless theme switching experience throughout the application.
 *
 * @example
 * ```jsx
 * // Wrap your application with the ThemeProvider
 * function App() {
 *   return (
 *     <ThemeProvider>
 *       <Router>
 *         <Routes>
 *           <Route path="/" element={<Home />} />
 *         </Routes>
 *       </Router>
 *     </ThemeProvider>
 *   );
 * }
 *
 * // Use theme in any component
 * function Header() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <header className="bg-white dark:bg-gray-900">
 *       <button
 *         onClick={toggleTheme}
 *         className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800"
 *         aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
 *       >
 *         {theme === 'dark' ? '🌞' : '🌙'}
 *       </button>
 *     </header>
 *   );
 * }
 * ```
 *
 * @component
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Child components that need access to theme functionality.
 * @returns {JSX.Element} ThemeContext provider with theme management capabilities.
 *
 * @since 1.0.0
 * @version 1.0.0
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, then system preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme;
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

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
   * Toggles between light and dark themes.
   *
   * @returns {void}
   */
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
