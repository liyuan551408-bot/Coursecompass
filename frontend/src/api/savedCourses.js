import request from './request'

export async function getSavedCourses() {
  const response = await request.get('/saved-courses')
  return response.data || []
}

export async function saveCourse(courseId) {
  const response = await request.post('/saved-courses', { courseId: Number(courseId) })
  return response.data
}

export function removeSavedCourse(courseId) {
  return request.delete(`/saved-courses/${courseId}`)
}
