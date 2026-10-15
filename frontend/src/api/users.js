import request from './request'

export async function getProfile() {
  const response = await request.get('/users/me')
  return response.data
}

export async function updateProfile(payload) {
  const response = await request.patch('/users/me', payload)
  return response.data
}

export async function getCompletedCourses() {
  const response = await request.get('/completed-courses')
  return response.data || []
}

export async function markCourseCompleted(courseId, completedAt) {
  const response = await request.put('/completed-courses', { courseId: Number(courseId), completedAt })
  return response.data
}

export function unmarkCourseCompleted(courseId) {
  return request.delete(`/completed-courses/${courseId}`)
}
