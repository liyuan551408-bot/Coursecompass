const ORIGIN_LABELS = {
  courses: 'Back to course catalogue',
  compare: 'Back to course comparison',
  saved: 'Back to saved courses',
  planner: 'Back to planner',
  dashboard: 'Back to dashboard',
}

export function courseDetailLocation(courseId, route, from) {
  return {
    name: 'CourseDetail',
    params: { id: Number(courseId) },
    query: {
      from,
      returnTo: route?.fullPath || '/',
    },
  }
}

export function safeReturnTarget(value) {
  const target = Array.isArray(value) ? value[0] : value
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return null
  return target
}

export function detailBackLabel(from) {
  const key = Array.isArray(from) ? from[0] : from
  return ORIGIN_LABELS[key] || ORIGIN_LABELS.courses
}
