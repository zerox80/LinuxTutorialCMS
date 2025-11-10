/**
 * Theme Toggle Component
 * 
 * A button component that allows users to switch between light and dark themes.
 * Displays a sun icon in dark mode and moon icon in light mode for intuitive UX.
 * 
 * Features:
 * - Visual feedback with icon changes
 * - Smooth transitions between themes
 * - Accessible with proper ARIA labels
 * - Responsive hover states
 * - Integrates with ThemeContext for global theme management
 * 
 * @component
 * @returns {JSX.Element} Theme toggle button with appropriate icon
 */

// Import icon components from Lucide React icon library
import { Moon, Sun } from 'lucide-react';

// Import custom hook to access theme context
import { useTheme } from '../context/ThemeContext';

/**
 * ThemeToggle Functional Component
 * 
 * Renders a button that toggles between light and dark themes.
 * Icon changes based on current theme for better user experience.
 */
const ThemeToggle = () => {
  // Destructure theme state and toggle function from theme context
  // theme: current theme value ('light' or 'dark')
  // toggleTheme: function to switch between themes
  const { theme, toggleTheme } = useTheme();
  
  return (
    // Toggle button with responsive styling for both light and dark modes
    <button
      // Call toggleTheme function when button is clicked
      onClick={toggleTheme}
      
      // Tailwind CSS classes for styling:
      // - p-2: padding on all sides
      // - rounded-lg: large rounded corners
      // - bg-gray-100: light background in light mode
      // - dark:bg-gray-800: dark background in dark mode
      // - hover:bg-gray-200: lighter on hover in light mode
      // - dark:hover:bg-gray-700: lighter on hover in dark mode
      // - transition-colors: smooth color transitions
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      
      // Accessibility label for screen readers
      // Includes the word "theme" to align with automated tests and clarity
      aria-label={`Toggle theme (switch to ${theme === 'dark' ? 'light' : 'dark'} mode)`}
    >
      {/* Conditional rendering based on current theme */}
      {theme === 'dark' ? (
        // Show Sun icon in dark mode (clicking will switch to light)
        // Yellow color suggests daylight/light mode
        <Sun className="w-5 h-5 text-yellow-500" />
      ) : (
        // Show Moon icon in light mode (clicking will switch to dark)
        // Gray color matches the light mode aesthetic
        <Moon className="w-5 h-5 text-gray-700" />
      )}
    </button>
  );
};

// Export component as default export for use in other components
export default ThemeToggle;
