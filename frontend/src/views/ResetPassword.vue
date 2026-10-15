<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { resetPasswordApi } from '../api/auth'
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const form = reactive({ email: typeof route.query.email === 'string' ? route.query.email : '', resetCode: '', newPassword: '', confirmPassword: '' })

async function submit() {
  if (!form.email || !form.resetCode || !form.newPassword) return ElMessage.warning('Complete every field.')
  if (!PASSWORD_POLICY.test(form.newPassword)) {
    return ElMessage.warning(PASSWORD_POLICY_MESSAGE)
  }
  if (form.newPassword !== form.confirmPassword) return ElMessage.warning('Passwords do not match.')
  loading.value = true
  try {
    const response = await resetPasswordApi({ email: form.email.trim(), resetCode: form.resetCode.trim(), newPassword: form.newPassword })
    ElMessage.success(response.message || 'Password reset successfully.')
    router.push('/login')
  } catch (err) { ElMessage.error(err.response?.data?.message || 'Unable to reset password.') }
  finally { loading.value = false }
}
</script>
<template><div class="auth-page"><el-card class="auth-card"><h1>Choose a new password</h1><p>Enter the verification code from your email before it expires.</p><el-form label-position="top"><el-form-item label="Email"><el-input v-model="form.email" type="email" autocomplete="email" /></el-form-item><el-form-item label="6-digit reset code"><el-input v-model="form.resetCode" maxlength="6" inputmode="numeric" /></el-form-item><el-form-item label="New password"><el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" placeholder="8+ chars, upper/lowercase, number and special character" /></el-form-item><el-form-item label="Confirm new password"><el-input v-model="form.confirmPassword" type="password" show-password autocomplete="new-password" @keyup.enter="submit" /></el-form-item><el-button type="primary" class="submit" :loading="loading" @click="submit">Reset password</el-button><el-button link @click="router.push({ name: 'ForgotPassword' })">Request another code</el-button></el-form></el-card></div></template>
<style scoped>.auth-page{min-height:65vh;display:grid;place-items:center}.auth-card{width:min(430px,100%)}h1{margin:0 0 8px;font-size:30px}.auth-card>p{margin-bottom:22px;color:var(--text);line-height:1.6}.submit{width:100%;margin-bottom:10px}</style>
