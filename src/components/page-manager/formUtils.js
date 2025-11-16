export const parseJsonField = (value, field) => {
  const trimmed = (value ?? '').trim()
  if (!trimmed) {
    return {}
  }
  try {
    return JSON.parse(trimmed)
  } catch (err) {
    const error = new Error(`Ungueltiges JSON in Feld "${field}": ${err.message}`)
    error.field = field
    throw error
  }
}

export const sanitizeInteger = (value, fallback = 0) => {
  if (value === '' || value === null || value === undefined) return fallback
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}
