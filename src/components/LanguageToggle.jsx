import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * A component that allows the user to toggle between supported languages (e.g., 'de' and 'en').
 * It displays the current language and updates the application's language setting on click.
 * @returns {JSX.Element} The rendered language toggle button.
 */
const LanguageToggle = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'de' ? 'en' : 'de';
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
      aria-label="Toggle language"
    >
      <Globe className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 uppercase">
        {i18n.language}
      </span>
    </button>
  );
};

export default LanguageToggle;
