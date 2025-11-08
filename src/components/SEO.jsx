import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';

/**
 * A component to manage Search Engine Optimization (SEO) metadata for a page.
 * It uses React Helmet to dynamically update the document head with relevant meta tags
 * for search engines and social media platforms.
 *
 * @param {object} props - The component props.
 * @param {string} [props.title] - The title of the page.
 * @param {string} [props.description] - A brief description of the page's content.
 * @param {string} [props.keywords] - Comma-separated keywords related to the page content.
 * @param {string} [props.image] - The URL of an image to represent the page on social media.
 * @param {string} [props.url] - The canonical URL of the page.
 * @param {string} [props.type='website'] - The Open Graph type of the content (e.g., 'website', 'article').
 * @param {string} [props.author] - The author of the content.
 * @param {string} [props.publishedTime] - The ISO 8601 timestamp of when the content was published.
 * @param {string} [props.modifiedTime] - The ISO 8601 timestamp of when the content was last modified.
 * @returns {JSX.Element} The rendered Helmet component with SEO metadata.
 */
const SEO = ({
  title,
  description,
  keywords,
  image,
  url,
  type = 'website',
  author,
  publishedTime,
  modifiedTime,
}) => {
  const siteTitle = 'Linux Tutorial CMS';
  const fullTitle = title ? `${title} | ${siteTitle}` : siteTitle;
  const defaultDescription = 'Lerne Linux von Grund auf - Interaktiv, modern und praxisnah';
  const defaultImage = '/linux-icon.svg';
  const baseUrl = window.location.origin;

  const metaDescription = description || defaultDescription;
  const metaImage = image || defaultImage;
  const metaUrl = url || window.location.href;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {author && <meta name="author" content={author} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:image" content={`${baseUrl}${metaImage}`} />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content="de_DE" />
      
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={`${baseUrl}${metaImage}`} />

      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <link rel="canonical" href={metaUrl} />
    </Helmet>
  );
};

SEO.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  keywords: PropTypes.string,
  image: PropTypes.string,
  url: PropTypes.string,
  type: PropTypes.string,
  author: PropTypes.string,
  publishedTime: PropTypes.string,
  modifiedTime: PropTypes.string,
};

export default SEO;
