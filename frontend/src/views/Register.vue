<script setup>

import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(false)
const formRef = ref(null)
const majors = [
  'Computer Science',
  'Data Science',
  'Software Engineering',
  'Information Technology',
  'Mathematics',
  'Business',
  'Psychology',
  'Education',
  'Health Science',
  'Other',
]

const form = reactive({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  major: '',
  studyYear: null,
})

const rules = {
  name: [{ required: true, message: 'Enter your name', trigger: 'blur' }],
  email: [
    { required: true, message: 'Enter your email address', trigger: 'blur' },
    { type: 'email', message: 'Enter a valid email address', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Enter a password', trigger: 'blur' },
    {
      pattern: PASSWORD_POLICY,
      message: PASSWORD_POLICY_MESSAGE,
      trigger: 'blur',
    },
  ],
  confirmPassword: [
    { required: true, message: 'Enter your password again', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.password) {
          callback(new Error('Passwords do not match'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

async function handleRegister() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  try {
    await authStore.register({ ...form })
    ElMessage.success('Account created and signed in successfully')
    router.push('/dashboard')
  } catch (err) {
    ElMessage.error(err.response?.data?.message || err.message || 'Account creation failed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <el-card class="auth-card" shadow="hover">
      <h1>Create a student account</h1>
      <p class="subtitle">Student accounts can register here. Contact an administrator if you need a staff account.</p>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="Name" prop="name">
          <el-input v-model="form.name" placeholder="Your name" autocomplete="name" />
        </el-form-item>

        <el-form-item label="Email" prop="email">
          <el-input
            v-model="form.email"
            placeholder="student@massey.ac.nz"
            type="email"
            autocomplete="email"
          />
        </el-form-item>

        <el-form-item label="Password" prop="password">
          <el-input
            v-model="form.password"
            placeholder="8+ chars, upper/lowercase, number and special character"
            type="password"
            show-password
            autocomplete="new-password"
          />
        </el-form-item>

        <el-form-item label="Confirm password" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            placeholder="Enter your password again"
            type="password"
            show-password
            autocomplete="new-password"
            @keyup.enter="handleRegister"
          />
        </el-form-item>

        <el-form-item label="Major (optional)" prop="major">
          <el-select v-model="form.major" filterable clearable placeholder="Select your major" style="width: 100%">
            <el-option v-for="major in majors" :key="major" :label="major" :value="major" />
          </el-select>
        </el-form-item>

        <el-form-item label="Year of study (optional)" prop="studyYear">
          <el-select v-model="form.studyYear" placeholder="Select year" clearable style="width: 100%">
            <el-option label="Year 1" :value="1" />
            <el-option label="Year 2" :value="2" />
            <el-option label="Year 3" :value="3" />
            <el-option label="Year 4+" :value="4" />
          </el-select>
        </el-form-item>

        <el-button type="primary" class="submit-btn" :loading="loading" @click="handleRegister">
          Create account
        </el-button>
      </el-form>

      <p class="footer-link">
        Already have an account?
        <router-link to="/login">Log in</router-link>
      </p>

    </el-card>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 72vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  text-align: left;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow: 0 24px 70px rgba(67, 42, 114, 0.16);
  overflow: hidden;
}

.auth-card h1 {
  font-size: 32px;
  margin: 0 0 4px;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: var(--text);
  margin-bottom: 24px;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}

.footer-link {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
}

.footer-link a {
  color: var(--accent);
  text-decoration: none;
}

</style>
