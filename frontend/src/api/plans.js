import request from './request'

export async function getPlans() {
  const response = await request.get('/plans')
  return response.data || []
}

export async function createPlan(payload) {
  const response = await request.post('/plans', payload)
  return response.data
}

export async function addPlanCourse(planId, courseId, { confirmPrerequisites = true } = {}) {
  const response = await request.post(`/plans/${planId}/courses`, {
    courseId: Number(courseId),
    confirmPrerequisites,
  })
  return {
    course: response.data,
    warnings: response.warnings || [],
    requiresConfirmation: Boolean(response.requiresConfirmation),
  }
}

export function removePlanCourse(planId, courseId) {
  return request.delete(`/plans/${planId}/courses/${courseId}`)
}

export function deletePlan(planId) {
  return request.delete(`/plans/${planId}`)
}
