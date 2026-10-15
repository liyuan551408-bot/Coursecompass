import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getSavedCourses, removeSavedCourse, saveCourse } from '../api/savedCourses'
import { useNotificationStore } from './notifications'

export const useSavedStore = defineStore('saved', () => {
  const records = ref([])
  const loading = ref(false)
  const loaded = ref(false)
  const courses = computed(() => records.value.map((record) => record.course))
  const savedIds = computed(() => courses.value.map((course) => Number(course.id)))
  const savedCount = computed(() => records.value.length)

  const isSaved = (courseId) => savedIds.value.includes(Number(courseId))

  async function loadSaved({ force = false } = {}) {
    if (loaded.value && !force) return records.value
    loading.value = true
    try {
      records.value = await getSavedCourses()
      loaded.value = true
      return records.value
    } finally {
      loading.value = false
    }
  }

  async function toggleSave(courseId) {
    const id = Number(courseId)
    const notificationStore = useNotificationStore()
    if (isSaved(id)) {
      await removeSavedCourse(id)
      records.value = records.value.filter((record) => Number(record.courseId) !== id)
      await notificationStore.refresh().catch(() => {})
      return false
    }
    const record = await saveCourse(id)
    records.value.unshift(record)
    loaded.value = true
    await notificationStore.refresh().catch(() => {})
    return true
  }

  async function removeSaved(courseId) {
    const id = Number(courseId)
    await removeSavedCourse(id)
    records.value = records.value.filter((record) => Number(record.courseId) !== id)
    await useNotificationStore().refresh().catch(() => {})
  }

  async function clearAll() {
    await Promise.all(savedIds.value.map((id) => removeSavedCourse(id)))
    records.value = []
  }

  function reset() {
    records.value = []
    loaded.value = false
  }

  return { records, courses, savedIds, savedCount, loading, loaded, isSaved, loadSaved, toggleSave, removeSaved, clearAll, reset }
})
