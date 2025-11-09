import { Helmet } from 'react-helmet-async'
import { useMemo } from 'react'
import { useContent } from '../context/ContentContext'
const FALLBACK_TITLE = 'Linux Tutorial - Lerne Linux Schritt für Schritt'
const FALLBACK_DESCRIPTION = 'Lerne Linux von Grund auf - Interaktiv, modern und praxisnah.'
const sanitize = (value) => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}
const GlobalSiteMeta = () => {
  const { getSiteMeta } = useContent()
  const meta = useMemo(() => {
    try {
      return typeof getSiteMeta === 'function' ? getSiteMeta() ?? {} : {}
    } catch (err) {
      console.warn('Failed to resolve site meta content:', err)
      return {}
    }
  }, [getSiteMeta])
  const title = sanitize(meta.title) || FALLBACK_TITLE
  const description = sanitize(meta.description) || FALLBACK_DESCRIPTION
  return (
    <Helmet>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:site_name" content={title} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:title" content={title} />
    </Helmet>
  )
}
export default GlobalSiteMeta
