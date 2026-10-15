import request from './request'

export async function getCourseReviews(courseId) {
  const response = await request.get(`/reviews/course/${courseId}`)
  return response.data || []
}

export async function submitReview(payload) {
  const response = await request.post('/reviews', payload)
  return response.data
}

export async function getMyCourseReview(courseId) {
  const response = await request.get(`/reviews/mine/course/${courseId}`)
  return response.data
}

export async function updateMyReview(courseId, payload) {
  const response = await request.put(`/reviews/course/${courseId}`, payload)
  return response.data
}

export async function reportReview(id, reason) {
  const response = await request.post(`/reviews/${id}/report`, { reason })
  return response.data
}

export async function getPendingReviews() {
  const response = await request.get('/reviews/pending')
  return response.data || []
}

export async function moderateReview(id, status) {
  const response = await request.patch(`/reviews/${id}/status`, { status })
  return response.data
}

export async function getPendingReports() {
  const response = await request.get('/reviews/reports/pending')
  return response.data || []
}

export async function getModerationQueueCounts() {
  const response = await request.get('/reviews/moderation/counts')
  return response.data || { reviews: 0, reports: 0, total: 0 }
}

export async function updateReportStatus(id, status) {
  const response = await request.patch(`/reviews/reports/${id}/status`, { status })
  return response.data
}
