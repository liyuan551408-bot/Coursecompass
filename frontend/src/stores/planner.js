import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { addPlanCourse, createPlan, deletePlan, getPlans, removePlanCourse } from '../api/plans'
import { useNotificationStore } from './notifications'

const normalizePlan = (plan) => ({
  ...plan,
  courses: (plan.planCourses || []).map((item) => item.course),
})

export const usePlannerStore = defineStore('planner', () => {
  const semesters = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const totalCredits = computed(() => semesters.value.reduce(
    (total, semester) => total + semester.courses.reduce((sum, course) => sum + (course.credits || 0), 0), 0,
  ))

  const getSemesterCourses = (semesterId) => semesters.value.find((item) => item.id === Number(semesterId))?.courses || []
  const isInPlanner = (courseId, semesterId = null) => semesters.value.some(
    (semester) => (semesterId === null || semester.id === Number(semesterId))
      && semester.courses.some((course) => course.id === Number(courseId)),
  )

  async function loadPlans({ force = false } = {}) {
    if (loaded.value && !force) return semesters.value
    loading.value = true
    try {
      semesters.value = (await getPlans()).map(normalizePlan)
      loaded.value = true
      return semesters.value
    } finally {
      loading.value = false
    }
  }

  async function addCourse(semesterId, course, options = { confirmPrerequisites: true }) {
    if (isInPlanner(course.id, semesterId)) return { added: false, warnings: [] }
    const semester = semesters.value.find((item) => item.id === Number(semesterId))
    if (!semester) return { added: false, warnings: [] }
    const result = await addPlanCourse(semester.id, course.id, options)
    if (result.requiresConfirmation) {
      return { added: false, warnings: result.warnings, requiresConfirmation: true }
    }
    semester.courses.push(result.course || course)
    await useNotificationStore().refresh().catch(() => {})
    return { added: true, warnings: result.warnings, requiresConfirmation: false }
  }

  async function addCourses(semesterId, courses) {
    const results = { added: [], skipped: [], warnings: [] }
    for (const course of courses) {
      if (isInPlanner(course.id, semesterId)) {
        results.skipped.push(course)
        continue
      }
      try {
        const result = await addCourse(semesterId, course)
        if (result.added) {
          results.added.push(course)
          if (result.warnings?.length) results.warnings.push(...result.warnings)
        } else {
          results.skipped.push(course)
        }
      } catch {
        results.skipped.push(course)
      }
    }
    return results
  }

  async function removeCourse(semesterId, courseId) {
    await removePlanCourse(semesterId, courseId)
    const semester = semesters.value.find((item) => item.id === Number(semesterId))
    if (semester) semester.courses = semester.courses.filter((course) => course.id !== Number(courseId))
    await useNotificationStore().refresh().catch(() => {})
  }

  async function addSemester(payload) {
    const plan = await createPlan(payload)
    semesters.value.push(normalizePlan(plan))
    await useNotificationStore().refresh().catch(() => {})
    return plan
  }

  async function removeSemester(semesterId) {
    await deletePlan(semesterId)
    semesters.value = semesters.value.filter((item) => item.id !== Number(semesterId))
  }

  async function clearAll() {
    await Promise.all(semesters.value.map((semester) => deletePlan(semester.id)))
    semesters.value = []
  }

  function reset() {
    semesters.value = []
    loaded.value = false
  }

  return { semesters, loading, loaded, totalCredits, getSemesterCourses, isInPlanner, loadPlans, addCourse, addCourses, removeCourse, addSemester, removeSemester, clearAll, reset }
})
