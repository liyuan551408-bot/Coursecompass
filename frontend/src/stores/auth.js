import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, registerApi } from '../api/auth'
import {
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  clearAuthStorage,
} from '../utils/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(getToken())
  const user = ref(getStoredUser())

  const isLoggedIn = computed(() => !!token.value)
  const normalizedRole = computed(() => user.value?.role?.toLowerCase())
  const isAdmin = computed(() => normalizedRole.value === 'admin')
  const isModerator = computed(() => normalizedRole.value === 'moderator')
  const isStudent = computed(() => normalizedRole.value === 'student')
  const userName = computed(() => user.value?.name || user.value?.email || '')

  function applyAuthData(data) {
    token.value = data.token
    user.value = data.user
    setToken(data.token)
    setStoredUser(data.user)
  }

  function updateUser(nextUser) {
    user.value = nextUser
    setStoredUser(nextUser)
  }

  async function login(credentials) {
    const data = await loginApi(credentials)
    applyAuthData(data)
    return data
  }

  async function register(formData) {
    await registerApi(formData)
    return login({ email: formData.email, password: formData.password, role: 'STUDENT' })
  }

  function logout() {
    token.value = null
    user.value = null
    clearAuthStorage()
  }

  function restoreSession() {
    token.value = getToken()
    user.value = getStoredUser()
  }

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    isModerator,
    isStudent,
    userName,
    updateUser,
    login,
    register,
    logout,
    restoreSession,
  }
})
