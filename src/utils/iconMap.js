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
 * Retrieves an icon component from the icon map based on its name.
 * If the requested icon is not found, it returns a fallback icon.
 *
 * @param {string} iconName - The name of the icon to retrieve.
 * @param {string} [fallback='Terminal'] - The name of the fallback icon to use if the requested icon is not found.
 * @returns {React.ElementType} The corresponding icon component or the fallback component.
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
