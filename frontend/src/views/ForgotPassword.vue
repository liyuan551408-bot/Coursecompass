<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { forgotPasswordApi } from '../api/auth'

const router = useRouter()
const loading = ref(false)
const form = reactive({ email: '' })

async function submit() {
  if (!form.email.trim()) return ElMessage.warning('Enter your email address.')
  loading.value = true
  try {
    const response = await forgotPasswordApi(form.email.trim())
    ElMessage.success(response.message || 'If the account exists, a reset code has been sent.')
    router.push({ name: 'ResetPassword', query: { email: form.email.trim() } })
  } catch (err) { ElMessage.error(err.response?.data?.message || 'Unable to request a reset code.') }
  finally { loading.value = false }
}
</script>
<template><div class="auth-page"><el-card class="auth-card"><el-button link @click="router.push('/login')">← Back to login</el-button><h1>Reset your password</h1><p>Enter your account email. If it exists, we will send a short-lived verification code.</p><el-form label-position="top"><el-form-item label="Email"><el-input v-model="form.email" type="email" autocomplete="email" @keyup.enter="submit" /></el-form-item><el-button type="primary" class="submit" :loading="loading" @click="submit">Send reset code</el-button></el-form></el-card></div></template>
<style scoped>.auth-page{min-height:65vh;display:grid;place-items:center}.auth-card{width:min(430px,100%)}h1{margin:18px 0 8px;font-size:30px}.auth-card>p{margin-bottom:22px;color:var(--text);line-height:1.6}.submit{width:100%}</style>
