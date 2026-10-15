import request from './request'

export async function getCourses({ skip = 0, take = 50 } = {}) {
  const response = await request.get('/courses', {
    params: { skip, take },
  })

  return response.data || []
}

export async function getAllCoursesForComparison() {
  const courses = []
  const pageSize = 100
  let skip = 0

  while (true) {
    const page = await getCourses({
      skip,
      take: pageSize,
    })

    courses.push(...page)

    if (page.length < pageSize) {
      break
    }

    skip += pageSize
  }

  return courses
}

export async function getAdminCourses() {
  const response = await request.get('/courses/admin/all')
  return response.data || []
}

export async function searchCourses(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
  const response = await request.get('/courses/search', { params })
  return response.data || []
}

export async function getCourse(id) {
  const response = await request.get(`/courses/${id}`)
  return response.data
}

export async function createCourse(payload) {
  const response = await request.post('/courses', payload)
  return response.data
}

export async function updateCourse(id, payload) {
  const response = await request.patch(`/courses/${id}`, payload)
  return response.data
}
