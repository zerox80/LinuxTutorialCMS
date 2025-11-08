import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';

/**
 * PostCSS pipeline used during builds to run Tailwind and add vendor prefixes.
 *
 * @type {import('postcss-load-config').ConfigInitializer}
 * @returns {{plugins: import('postcss').AcceptedPlugin[]}} Plugin configuration for PostCSS.
 */
export default {
  plugins: [
    tailwindcss(),
    autoprefixer,
  ],
};
