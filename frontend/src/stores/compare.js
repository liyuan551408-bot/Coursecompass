import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'course-compass:compare-state:v1'
const MAX_COMPARE = 4

function readSessionState() {
  if (typeof window === 'undefined') return {}
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

export const useCompareStore = defineStore('compare', () => {
  const restored = readSessionState()
  const selectedCourses = ref(Array.isArray(restored.selectedCourses) ? restored.selectedCourses.slice(0, MAX_COMPARE) : [])
  const analysis = ref(restored.analysis && typeof restored.analysis === 'object' ? restored.analysis : null)
  const originCourseId = ref(Number.isInteger(restored.originCourseId) ? restored.originCourseId : null)
  const searchQuery = ref(typeof restored.searchQuery === 'string' ? restored.searchQuery : '')
  const subjectId = ref(Number.isInteger(restored.subjectId) ? restored.subjectId : null)
  // Share the request lock across page remounts; never restore an in-flight lock from storage.
  const generating = ref(false)
  const summaryStreaming = ref(false)

  const selectedIds = computed(() => selectedCourses.value.map(course => Number(course.id)))
  const canAdd = computed(() => selectedCourses.value.length < MAX_COMPARE)

  function persist() {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedCourses: selectedCourses.value,
        analysis: analysis.value,
        originCourseId: originCourseId.value,
        searchQuery: searchQuery.value,
        subjectId: subjectId.value,
      }))
    } catch {

    }
  }

  function addCourse(course) {
    const id = Number(course?.id)
    if (generating.value || !Number.isInteger(id) || selectedIds.value.includes(id) || !canAdd.value) return false
    selectedCourses.value.push(course)
    analysis.value = null
    summaryStreaming.value = false
    persist()
    return true
  }

  function removeCourse(courseId) {
    const id = Number(courseId)
    if (generating.value || id === originCourseId.value) return false
    selectedCourses.value = selectedCourses.value.filter(course => Number(course.id) !== id)
    analysis.value = null
    summaryStreaming.value = false
    persist()
    return true
  }

  function setOrigin(courseId) {
    const id = Number(courseId)
    originCourseId.value = Number.isInteger(id) && id > 0 ? id : null
    persist()
  }

  function setSearch(value) {
    searchQuery.value = String(value || '')
    persist()
  }

  function setSubject(value) {
    const id = Number(value)
    subjectId.value = Number.isInteger(id) && id > 0 ? id : null
    persist()
  }

  function clearSelection({ keepOrigin = true } = {}) {
    if (generating.value) return false
    const origin = keepOrigin
      ? selectedCourses.value.find(course => Number(course.id) === originCourseId.value)
      : null
    selectedCourses.value = origin ? [origin] : []
    if (!keepOrigin) originCourseId.value = null
    analysis.value = null
    summaryStreaming.value = false
    persist()
    return true
  }

  // Lock before starting the request so repeated clicks cannot launch duplicate AI calls.
  function beginGeneration() {
    if (generating.value || selectedCourses.value.length < 2) return false
    generating.value = true
    return true
  }

  function finishGeneration(result) {
    analysis.value = result
    generating.value = false
    summaryStreaming.value = Boolean(result?.summary)
    persist()
  }

  function endGeneration() {
    generating.value = false
  }

  function completeSummaryStream() {
    summaryStreaming.value = false
  }

  return {
    selectedCourses,
    selectedIds,
    analysis,
    originCourseId,
    searchQuery,
    subjectId,
    generating,
    summaryStreaming,
    canAdd,
    addCourse,
    removeCourse,
    setOrigin,
    setSearch,
    setSubject,
    clearSelection,
    beginGeneration,
    finishGeneration,
    endGeneration,
    completeSummaryStream,
    persist,
  }
})

export { MAX_COMPARE, STORAGE_KEY }
