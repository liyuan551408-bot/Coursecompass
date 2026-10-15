import request from './request'

export async function getCourseRecommendations(query, filters = {}) {

  const response = await request.post('/ai/recommend', { query, ...filters }, { timeout: 150000 })
  return response.data
}

export async function getCourseComparisonAnalysis(courseIds) {

  const response = await request.post('/ai/compare', { courseIds }, { timeout: 150000 })
  return response.data
}
