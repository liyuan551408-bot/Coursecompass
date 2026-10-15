<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getCompletedCourses, getProfile } from '../api/users'
import { useAuthStore } from '../stores/auth'
import { usePlannerStore } from '../stores/planner'
import { courseDetailLocation } from '../utils/courseNavigation'
import { useSavedStore } from '../stores/saved'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const savedStore = useSavedStore()
const plannerStore = usePlannerStore()
const profile = ref(null)
const completedCourses = ref([])
const loading = ref(true)
const plannedCourseCount = computed(() => plannerStore.semesters.reduce((sum, plan) => sum + plan.courses.length, 0))

async function loadDashboard() {
  loading.value = true
  try {
    const [user, completed] = await Promise.all([getProfile(), getCompletedCourses(), savedStore.loadSaved({ force: true }), plannerStore.loadPlans({ force: true })])
    profile.value = user
    completedCourses.value = completed
    authStore.updateUser(user)
  } catch (err) { ElMessage.error(err.response?.data?.message || 'Unable to load dashboard data.') }
  finally { loading.value = false }
}

onMounted(loadDashboard)
</script>

<template>
  <section v-loading="loading" class="dashboard-page">
    <header class="welcome"><div><p class="eyebrow">STUDENT DASHBOARD</p><h1>Welcome back, {{ authStore.userName }}</h1><p>{{ profile?.major || 'Add your major' }}<span v-if="profile?.studyYear"> · Study year {{ profile.studyYear }}</span></p></div><el-button type="primary" @click="router.push('/courses')">Explore courses</el-button></header>

    <div class="stat-grid">
      <button @click="router.push('/saved')"><strong>{{ savedStore.savedCount }}</strong><span>Saved courses</span></button>
      <button @click="router.push('/planner')"><strong>{{ plannedCourseCount }}</strong><span>Planned courses</span></button>
      <button @click="router.push('/planner')"><strong>{{ plannerStore.totalCredits }}</strong><span>Planned credits</span></button>
      <button @click="router.push('/profile')"><strong>{{ completedCourses.length }}</strong><span>Completed courses</span></button>
    </div>

    <div class="dashboard-grid">
      <el-card><template #header><div class="card-header"><strong>Saved for later</strong><el-button link type="primary" @click="router.push('/saved')">View all</el-button></div></template><div v-for="course in savedStore.courses.slice(0,4)" :key="course.id" class="course-row" @click="router.push(courseDetailLocation(course.id, route, 'dashboard'))"><span><b>{{ course.code }}</b>{{ course.name }}</span><small>{{ course.credits }} credits</small></div><el-empty v-if="!savedStore.courses.length" description="No saved courses yet" :image-size="65" /></el-card>

      <el-card><template #header><div class="card-header"><strong>Current semester plans</strong><el-button link type="primary" @click="router.push('/planner')">Open planner</el-button></div></template><div v-for="plan in plannerStore.semesters.slice(0,4)" :key="plan.id" class="plan-row"><div><b>{{ plan.name }}</b><span>{{ plan.year }} · {{ plan.semester.replaceAll('_', ' ') }}</span></div><el-tag>{{ plan.courses.length }} courses</el-tag></div><el-empty v-if="!plannerStore.semesters.length" description="No plans created yet" :image-size="65" /></el-card>

      <el-card class="ai-card"><p class="eyebrow">AI COURSE COMPASS</p><h2>Recommendations shaped around your goals</h2><p>{{ profile?.goals?.length ? `Use your goals — ${profile.goals.join(', ')} — as context for your next course search.` : 'Add goals to your profile, then ask the AI to help find your next courses.' }}</p><el-button type="primary" @click="router.push('/ai-recommend')">Get AI recommendations</el-button></el-card>

      <el-card><template #header><div class="card-header"><strong>Completed courses</strong><el-button link type="primary" @click="router.push('/profile')">Manage</el-button></div></template><div v-for="record in completedCourses.slice(0,4)" :key="record.course.id" class="course-row"><span><b>{{ record.course.code }}</b>{{ record.course.name }}</span><small>{{ record.course.credits }} credits</small></div><el-empty v-if="!completedCourses.length" description="No completed courses recorded" :image-size="65" /></el-card>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page{max-width:1060px;margin:0 auto;min-height:320px}.welcome{display:flex;align-items:end;justify-content:space-between;gap:24px;padding:30px;border:1px solid var(--accent-border);border-radius:20px;background:linear-gradient(135deg,var(--accent-bg),rgba(255,255,255,.7))}.welcome h1{margin:7px 0;font-size:40px}.welcome>div>p:last-child{color:var(--text)}.eyebrow{color:var(--accent);font:700 11px/1.4 var(--mono);letter-spacing:.13em}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.stat-grid button{display:flex;flex-direction:column;padding:19px;text-align:left;border:1px solid var(--border);border-radius:14px;background:rgba(255,255,255,.8);cursor:pointer}.stat-grid strong{color:var(--text-h);font-size:27px}.stat-grid span{color:var(--text);font-size:13px}.dashboard-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.card-header{display:flex;align-items:center;justify-content:space-between}.course-row,.plan-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)}.course-row{cursor:pointer}.course-row span{display:flex;flex-direction:column;color:var(--text-h)}.course-row b{color:var(--accent);font-size:12px}.course-row small,.plan-row span{color:var(--text)}.plan-row>div{display:flex;flex-direction:column}.ai-card{background:linear-gradient(145deg,rgba(114,81,232,.14),rgba(255,255,255,.8))}.ai-card h2{margin:8px 0}.ai-card>p:not(.eyebrow){line-height:1.65;margin-bottom:20px}@media(max-width:760px){.welcome{align-items:start;flex-direction:column}.welcome h1{font-size:31px}.stat-grid{grid-template-columns:1fr 1fr}.dashboard-grid{grid-template-columns:1fr}}
</style>
