export const CREDIT_RANGE = Object.freeze({ min: 0, max: 120, step: 15 })
export const WORKLOAD_RANGE = Object.freeze({ min: 150, max: 1200, step: 150 })

export function createDefaultCourseFilters() {
  return {
    subjectId: '',
    level: '',
    semester: '',
    assessmentType: '',
    creditsRange: [CREDIT_RANGE.min, CREDIT_RANGE.max],
    workloadRange: [WORKLOAD_RANGE.min, WORKLOAD_RANGE.max],
    creditsRangeActive: false,
    workloadRangeActive: false,
    minRating: null,
    hasPrerequisites: '',
  }
}

export function filtersToApiParams(filters) {
  const params = {}
  for (const field of ['subjectId', 'level', 'semester', 'assessmentType', 'minRating', 'hasPrerequisites']) {
    if (filters[field] !== '' && filters[field] !== null && filters[field] !== undefined) params[field] = filters[field]
  }
  const credits = filters.creditsRange || [CREDIT_RANGE.min, CREDIT_RANGE.max]
  const workload = filters.workloadRange || [WORKLOAD_RANGE.min, WORKLOAD_RANGE.max]
  if (filters.creditsRangeActive || credits[0] !== CREDIT_RANGE.min || credits[1] !== CREDIT_RANGE.max) {
    params.minCredits = credits[0]
    params.maxCredits = credits[1]
  }
  if (filters.workloadRangeActive || workload[0] !== WORKLOAD_RANGE.min || workload[1] !== WORKLOAD_RANGE.max) {
    params.minWorkload = workload[0]
    params.maxWorkload = workload[1]
  }
  return params
}

export function filtersFromQuery(query = {}) {
  const defaults = createDefaultCourseFilters()
  const numberOr = (value, fallback) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return {
    ...defaults,
    subjectId: query.subjectId ? numberOr(query.subjectId, '') : '',
    level: query.level ? numberOr(query.level, '') : '',
    semester: typeof query.semester === 'string' ? query.semester : '',
    assessmentType: typeof query.assessmentType === 'string' ? query.assessmentType : '',
    creditsRange: [
      numberOr(query.minCredits, CREDIT_RANGE.min),
      numberOr(query.maxCredits, CREDIT_RANGE.max),
    ],
    workloadRange: [
      numberOr(query.minWorkload, WORKLOAD_RANGE.min),
      numberOr(query.maxWorkload, WORKLOAD_RANGE.max),
    ],
    creditsRangeActive: query.minCredits !== undefined || query.maxCredits !== undefined,
    workloadRangeActive: query.minWorkload !== undefined || query.maxWorkload !== undefined,
    minRating: query.minRating ? numberOr(query.minRating, null) : null,
    hasPrerequisites: typeof query.hasPrerequisites === 'string' ? query.hasPrerequisites : '',
  }
}
