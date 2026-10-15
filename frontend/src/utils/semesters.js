export function normalizeSemesters(value) {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return []

  const content = value.trim().replace(/^\{/, '').replace(/\}$/, '')
  return content
    ? content.split(',').map((semester) => semester.trim().replace(/^"|"$/g, '')).filter(Boolean)
    : []
}
