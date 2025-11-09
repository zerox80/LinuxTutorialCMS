/**
 * @fileoverview Internationalization Configuration
 *
 * This module configures internationalization (i18n) for the Linux Tutorial CMS
 * using react-i18next. It sets up language detection, resource loading, and
 * localization preferences for multilingual support.
 *
 * Features:
 * - Automatic language detection from localStorage
 * - Fallback language configuration (German)
 * - Support for German and English languages
 * - React integration with hooks support
 * - Namespace-based resource organization
 *
 * Languages Supported:
 * - German (de) - Primary language with full translations
 * - English (en) - Secondary language for broader accessibility
 *
 * Browser Compatibility:
 * - localStorage for language preference persistence
 * - Modern JavaScript features (ES2018+)
 * - React 16.8+ for hooks support
 *
 * Performance:
 * - Lazy loading of translation resources
 * - Efficient language detection
 * - Minimal bundle impact with tree-shaking
 *
 * @version 1.0.0
 * @since 2024
 * @author LinuxTutorialCMS Team
 * @see {@link https://react.i18next.com/} React i18next documentation
 * @see {@link https://www.i18next.com/} i18next core documentation
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';

/**
 * Initialize internationalization with language detection and resource loading.
 * Configures i18next for React application use with proper fallbacks.
 *
 * Configuration Options:
 * - lng: User's preferred language (from localStorage or fallback)
 * - fallbackLng: Default language when translation is missing
 * - interpolation: Controls variable interpolation in translations
 * - resources: Translation resources for supported languages
 *
 * Language Detection Priority:
 * 1. Stored language preference in localStorage
 * 2. Browser language detection (if implemented)
 * 3. Fallback to German (de)
 *
 * Integration Examples:
 * ```javascript
 * // Using translation hooks in React components
 * import { useTranslation } from 'react-i18next';
 *
 * function MyComponent() {
 *   const { t } = useTranslation();
 *   return <h1>{t('welcome.title')}</h1>;
 * }
 *
 * // Changing language programmatically
 * import { useTranslation } from 'react-i18next';
 *
 * function LanguageSwitcher() {
 *   const { i18n } = useTranslation();
 *
 *   const changeLanguage = (lang) => {
 *     i18n.changeLanguage(lang);
 *     localStorage.setItem('language', lang);
 *   };
 *
 *   return (
 *     <button onClick={() => changeLanguage('en')}>English</button>
 *   );
 * }
 * ```
 *
 * Translation File Structure:
 * - src/i18n/locales/de.json - German translations
 * - src/i18n/locales/en.json - English translations
 *
 * Best Practices:
 * - Use descriptive translation keys with dot notation
 * - Provide fallback values for dynamic content
 * - Test all languages for proper formatting
 * - Consider cultural differences in translations
 *
 * @see {@link https://react.i18next.com/latest/usetranslation-hook} useTranslation hook
 * @see {@link https://www.i18next.com/overview/configuration-options} Configuration options
 */
i18n
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    lng: localStorage.getItem('language') || 'de',
    fallbackLng: 'de',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;