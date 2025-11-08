/**
 * @file This file configures the i18next library for internationalization.
 * It initializes i18next with English and German translations, sets the default language,
 * and integrates with React.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';

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

/**
 * Configured i18next instance with German and English resources for the frontend.
 *
 * @returns {import('i18next').i18n} Initialized translation engine.
 */
export default i18n;
