/**
 * @fileoverview Icon Mapping Utility
 *
 * This module provides a centralized icon mapping system for the Linux Tutorial CMS.
 * It maps string identifiers to Lucide React icon components, enabling dynamic
 * icon selection throughout the application.
 *
 * Features:
 * - Centralized icon registry for consistent icon usage
 * - Fallback system for missing icons
 * - Type-safe icon component retrieval
 * - Extensible architecture for adding new icons
 *
 * Dependencies:
 * - lucide-react: Icon library providing consistent, high-quality SVG icons
 * - React: Components are React elements that can be rendered in JSX
 *
 * Browser Compatibility:
 * - Works in all modern browsers with React support
 * - Icons are rendered as SVG elements for scalability and quality
 * - No additional polyfills required
 *
 * Performance:
 * - Static mapping with O(1) lookup time complexity
 * - Icons are tree-shakable - unused icons are not included in bundle
 * - Minimal overhead with simple object property access
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 * @see {@link https://lucide.dev/} Lucide icon library documentation
 */

import {
  Terminal,
  FolderTree,
  FileText,
  Settings,
  Shield,
  Network,
  Database,
  Server,
  Book,
  Code,
  Zap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Compass,
  Layers,
  ShieldCheck,
  Github,
  Mail,
  Heart,
  Lock,
  Home,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
} from 'lucide-react'

/**
 * Central mapping of icon name strings to Lucide React icon components.
 * This registry provides type-safe icon lookup and enables dynamic icon selection.
 *
 * Each entry maps a string identifier to the corresponding Lucide icon component.
 * The mapping is designed to be:
 * - Consistent with common UI terminology
 * - Easy to extend with new icons
 * - Memory efficient with static imports
 *
 * Available Icon Categories:
 * - Navigation: Home, ArrowRight, Compass
 * - Content: Book, BookOpen, FileText, Code
 * - System: Terminal, Server, Database, Network
 * - Actions: Plus, Edit, Trash2, RefreshCw
 * - Security: Shield, ShieldCheck, Lock
 * - Social: Github, Mail, Heart
 * - UI: Settings, Layers, FolderTree
 * - Effects: Zap, Sparkles
 *
 * @type {Object.<string, React.ComponentType>}
 * @readonly
 * @see {@link https://lucide.dev/icons/} Complete list of available Lucide icons
 */
const ICON_MAP = {
  Terminal,
  FolderTree,
  FileText,
  Settings,
  Shield,
  Network,
  Database,
  Server,
  Book,
  Code,
  Zap,
  Sparkles,
  ArrowRight,
  BookOpen,
  Compass,
  Layers,
  ShieldCheck,
  Github,
  Mail,
  Heart,
  Lock,
  Home,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
}

/**
 * Retrieves an icon component by name from the icon mapping registry.
 * Provides a robust fallback system to prevent UI errors when icons are missing.
 *
 * @function getIconComponent
 * @param {string} iconName - Name of the icon to retrieve from the ICON_MAP
 * @param {string} [fallback='Terminal'] - Fallback icon name if iconName not found in mapping
 * @returns {React.ComponentType} Lucide React icon component ready for rendering
 *
 * @throws {TypeError} If iconName is not a string (handled gracefully)
 *
 * @example
 * // Basic usage with valid icon name
 * const Icon = getIconComponent('Home')
 * // Returns: Home component from lucide-react
 * <Icon size={24} color="#333" />
 *
 * @example
 * // Usage with custom fallback
 * const Icon = getIconComponent('NonExistentIcon', 'Settings')
 * // Returns: Settings component (fallback since 'NonExistentIcon' doesn't exist)
 * <Icon />
 *
 * @example
 * // Integration in React component
 * function IconDisplay({ iconName, size = 20, color = '#000' }) {
 *   const IconComponent = getIconComponent(iconName, 'Terminal')
 *
 *   return (
 *     <div className="icon-wrapper">
 *       <IconComponent size={size} color={color} />
 *     </div>
 *   )
 * }
 *
 * @example
 * // Dynamic icon selection based on content type
 * function ContentIcon({ contentType }) {
 *   const iconMap = {
 *     tutorial: 'BookOpen',
 *     command: 'Terminal',
 *     security: 'Shield',
 *     network: 'Network'
 *   }
 *
 *   const iconName = iconMap[contentType] || 'FileText'
 *   const Icon = getIconComponent(iconName, 'Terminal')
 *
 *   return <Icon />
 * }
 *
 * Error Handling:
 * - Returns fallback icon when requested icon doesn't exist
 * - Defaults to 'Terminal' icon if fallback is also invalid
 * - Gracefully handles undefined or null icon names
 * - Console warnings can be added for debugging missing icons
 *
 * Performance Characteristics:
 * - O(1) lookup time using object property access
 * - No additional computation or validation overhead
 * - Static imports enable tree-shaking for optimal bundle size
 *
 * Integration Examples:
 * - Navigation menus with dynamic icons
 * - Content type indicators
 * - Button icons based on actions
 * - Status indicators with appropriate icons
 * - Category labels with themed icons
 *
 * @see {@link ICON_MAP} for complete list of available icons
 * @see {@link https://lucide.dev/docs/usage} Lucide React usage documentation
 * @see {@link https://reactjs.org/docs/components-and-props.html} React component documentation
 */
export const getIconComponent = (iconName, fallback = 'Terminal') => {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName]
  }

  if (!ICON_MAP[fallback]) {
    return Terminal
  }

  return ICON_MAP[fallback]
}
