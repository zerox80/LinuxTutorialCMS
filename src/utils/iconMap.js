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
export const getIconComponent = (iconName, fallback = 'Terminal') => {
  if (iconName && ICON_MAP[iconName]) {
    return ICON_MAP[iconName]
  }
  if (!ICON_MAP[fallback]) {
    return Terminal
  }
  return ICON_MAP[fallback]
}
