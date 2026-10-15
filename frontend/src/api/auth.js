import request from './request'

export function loginApi(credentials) {
  return request.post('/auth/login', credentials, { skipAuthRedirect: true }).then((response) => ({
    token: response.token,
    user: response.data,
  }))
}

export function registerApi(data) {
  return request.post('/auth/register', data)
}

export function forgotPasswordApi(email) {

  return request.post('/auth/forgot-password', { email }, { timeout: 30000 })
}

export function resetPasswordApi(payload) {
  return request.post('/auth/reset-password', payload)
}

