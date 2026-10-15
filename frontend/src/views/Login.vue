<script setup>

import { computed, ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loading = ref(false)

const form = reactive({
  role: '',
  email: '',
  password: '',
})

const roleOptions = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'ADMIN', label: 'Administrator' },
]

const selectedRole = computed(() => roleOptions.find((option) => option.value === form.role))

function selectRole(role) {
  form.role = role
}

function changeRole() {
  form.role = ''
}

const rules = {
  email: [
    { required: true, message: 'Enter your email address', trigger: 'blur' },
    { type: 'email', message: 'Enter a valid email address', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Enter your password', trigger: 'blur' },
  ],
}

const formRef = ref(null)
async function handleLogin() {
  if (!form.role) {
    ElMessage.warning('Select your account type first.')
    return
  }
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.login({ role: form.role, email: form.email, password: form.password })
    ElMessage.success('Signed in successfully')

    const defaultRoute = authStore.isAdmin ? '/admin' : authStore.isModerator ? '/moderation' : '/dashboard'
    const redirect = route.query.redirect || defaultRoute
    router.push(typeof redirect === 'string' ? redirect : defaultRoute)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || 'Sign-in failed. Check your email and password.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <el-card class="login-card" shadow="never">
      <template v-if="!form.role">
        <div class="login-heading">
          <h1>Choose your account type</h1>
          <p>Select how you use CourseCompass.</p>
        </div>

        <div class="role-grid">
          <button v-for="option in roleOptions" :key="option.value" type="button" class="role-card" @click="selectRole(option.value)">
            <strong>{{ option.label }}</strong>
            <span class="role-arrow">→</span>
          </button>
        </div>
      </template>

      <template v-else>
        <div class="selected-role">
          <span>Signing in as <strong>{{ selectedRole.label }}</strong></span>
          <el-button link type="primary" @click="changeRole">Change</el-button>
        </div>

        <div class="login-heading credentials-heading">
          <h1>Welcome back</h1>
          <p>Enter the credentials for your {{ selectedRole.label.toLowerCase() }} account.</p>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item label="Email" prop="email">
            <el-input v-model="form.email" placeholder="name@massey.ac.nz" type="email" autocomplete="email" />
          </el-form-item>

          <el-form-item label="Password" prop="password">
            <el-input v-model="form.password" placeholder="Enter your password" type="password" show-password autocomplete="current-password" @keyup.enter="handleLogin" />
          </el-form-item>

          <div class="forgot-link"><router-link to="/forgot-password">Forgot password?</router-link></div>

          <el-button type="primary" class="login-btn" :loading="loading" @click="handleLogin">
            Log in as {{ selectedRole.label }}
          </el-button>
        </el-form>
      </template>

      <p v-if="!form.role || form.role === 'STUDENT'" class="footer-link">New to CourseCompass? <router-link to="/register">Create a student account</router-link></p>

    </el-card>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 440px;
  text-align: left;
}

.login-card :deep(.el-card__body) {
  padding: 30px;
}

.login-heading {
  margin-bottom: 20px;
}

.login-heading h1 {
  margin: 0 0 7px;
  color: var(--text-h);
  font-size: 26px;
}

.login-heading > p:last-child {
  margin: 0;
  color: var(--text);
  line-height: 1.55;
}

.role-grid {
  display: grid;
  gap: 10px;
}

.role-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 13px;
  width: 100%;
  padding: 15px 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-card);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition: border-color .15s ease, background .15s ease;
}

.role-card:hover,
.role-card:focus-visible {
  border-color: var(--accent);
  background: var(--accent-bg);
}

.role-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.role-card strong {
  color: var(--text-h);
  font-size: 15px;
}

.role-arrow {
  color: var(--accent);
  font-size: 20px;
}

.selected-role {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.selected-role strong {
  color: var(--text-h);
}

.credentials-heading {
  margin-bottom: 18px;
}

.login-btn {
  width: 100%;
  margin-top: 8px;
}
.forgot-link { margin-top: -10px; margin-bottom: 12px; text-align: right; font-size: 13px; }
.forgot-link a { color: var(--accent); text-decoration: none; }

.footer-link {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
}

.footer-link a {
  color: var(--accent);
  text-decoration: none;
}

@media (max-width: 520px) {
  .login-page { padding: 8px; }
  .login-card :deep(.el-card__body) { padding: 22px; }
}

</style>
