import axios from 'axios'
import { getToken, clearAuthStorage } from '../utils/auth'
import router from '../router'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Login requests can opt out; expired sessions clear shared auth state and retain a return path.
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      clearAuthStorage()
      window.dispatchEvent(new Event('course-compass:unauthorized'))
      if (router.currentRoute.value.name !== 'Login') {
        router.push({ name: 'Login', query: { redirect: router.currentRoute.value.fullPath } })
      }
    }
    return Promise.reject(error)
  }
)

export default request
