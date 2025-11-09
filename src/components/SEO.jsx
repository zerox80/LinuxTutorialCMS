import { Helmet } from 'react-helmet-async';
import PropTypes from 'prop-types';

/**
 * SEO component for managing page metadata and social media tags.
 * Sets HTML head tags for search engines and social media platforms.
 * 
 * @param {Object} props - Component props
 * @param {string} [props.title] - Page title
 * @param {string} [props.description] - Page description
 * @param {string} [props.keywords] - SEO keywords
 * @param {string} [props.image] - Social media preview image path
 * @param {string} [props.url] - Canonical URL
 * @param {string} [props.type='website'] - Open Graph type
 * @param {string} [props.author] - Content author
 * @param {string} [props.publishedTime] - Article publish time (ISO 8601)
 * @param {string} [props.modifiedTime] - Article modification time (ISO 8601)
 * @returns {JSX.Element} Helmet component with configured meta tags
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
      {}
      <title>{fullTitle}</title>
      <meta name="description" content={metaDescription} />
      {keywords && <meta name="keywords" content={keywords} />}
      {author && <meta name="author" content={author} />}

      {}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={metaUrl} />
      <meta property="og:image" content={`${baseUrl}${metaImage}`} />
      <meta property="og:site_name" content={siteTitle} />
      <meta property="og:locale" content="de_DE" />
      
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={`${baseUrl}${metaImage}`} />

      {}
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
