<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCompletedCourses, getProfile, markCourseCompleted, unmarkCourseCompleted, updateProfile } from '../api/users'
import { useAuthStore } from '../stores/auth'
import { usePlannerStore } from '../stores/planner'
import KeywordTagInput from '../components/KeywordTagInput.vue'
import { GOAL_KEYWORDS, INTEREST_KEYWORDS } from '../utils/profileKeywords'

const authStore = useAuthStore()
const plannerStore = usePlannerStore()
const loading = ref(true)
const saving = ref(false)
const completedLoading = ref(false)
const profile = ref(null)
const completed = ref([])
const selectedCourseId = ref(null)
const completedQuery = ref('')
const savedSnapshot = ref('')
const saveFeedback = ref('')
let feedbackTimer

const assessmentOptions = ['EXAM', 'ASSIGNMENT', 'QUIZ', 'PROJECT', 'LAB', 'PRESENTATION']
const emptyPlanningPreferences = () => ({
  maxCreditsPerSemester: null,
  preferredAssessmentTypes: [],
  preferredWorkload: null,
  avoidExamHeavy: false,
})
const form = reactive({
  name: '',
  major: '',
  studyYear: null,
  interests: [],
  goals: [],
  planningPreferences: emptyPlanningPreferences(),
})

function profileDraft() {
  const maxCredits = form.planningPreferences.maxCreditsPerSemester
  return profile.value?.role === 'STUDENT'
    ? {
        name: form.name,
        major: form.major,
        studyYear: form.studyYear,
        interests: [...form.interests],
        goals: [...form.goals],
        planningPreferences: {
          ...form.planningPreferences,
          maxCreditsPerSemester: maxCredits === '' ? null : maxCredits,
          preferredAssessmentTypes: [...form.planningPreferences.preferredAssessmentTypes],
        },
      }
    : { name: form.name }
}

const completedIds = computed(() => new Set(completed.value.map((item) => item.courseId)))
const plannedCourses = computed(() => {
  const unique = new Map()
  plannerStore.semesters.forEach((semester) => {
    semester.courses.forEach((course) => unique.set(Number(course.id), course))
  })
  return [...unique.values()].sort((left, right) => left.code.localeCompare(right.code))
})
const availableCourses = computed(() => plannedCourses.value.filter((course) => !completedIds.value.has(course.id)))
const completedCredits = computed(() => completed.value.reduce((sum, item) => sum + (item.course.credits || 0), 0))
const hasUnsavedChanges = computed(() => Boolean(profile.value) && JSON.stringify(profileDraft()) !== savedSnapshot.value)
const filteredCompleted = computed(() => {
  const query = completedQuery.value.trim().toLowerCase()
  return [...completed.value]
    .filter((item) => !query || `${item.course.code} ${item.course.name}`.toLowerCase().includes(query))
    .sort((a, b) => a.course.code.localeCompare(b.course.code))
})

function fillForm(user) {
  const preferences = user.planningPreferences && typeof user.planningPreferences === 'object'
    ? user.planningPreferences
    : {}
  Object.assign(form, {
    name: user.name || '',
    major: user.major || '',
    studyYear: user.studyYear,
    interests: [...(user.interests || [])],
    goals: [...(user.goals || [])],
    planningPreferences: {
      ...emptyPlanningPreferences(),
      ...preferences,
      preferredAssessmentTypes: [...(preferences.preferredAssessmentTypes || [])],
    },
  })
  savedSnapshot.value = JSON.stringify(profileDraft())
}

function showSavedFeedback(message) {
  clearTimeout(feedbackTimer)
  saveFeedback.value = message
  feedbackTimer = window.setTimeout(() => { saveFeedback.value = '' }, 3500)
}

function resetChanges() {
  if (profile.value) fillForm(profile.value)
  saveFeedback.value = ''
}

function handleBeforeUnload(event) {
  if (!hasUnsavedChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

async function loadPage() {
  loading.value = true
  try {
    const [user, completedRecords] = await Promise.all([
      getProfile(),
      authStore.isStudent ? getCompletedCourses() : Promise.resolve([]),
      authStore.isStudent ? plannerStore.loadPlans({ force: true }) : Promise.resolve(),
    ])
    profile.value = user
    completed.value = completedRecords
    fillForm(user)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to load your profile.')
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  if (!form.name.trim()) return ElMessage.warning('Name is required.')
  saving.value = true
  saveFeedback.value = ''
  try {
    const payload = authStore.isStudent
      ? profileDraft()
      : { name: form.name }
    const user = await updateProfile(payload)
    profile.value = user
    fillForm(user)
    authStore.updateUser(user)
    showSavedFeedback('Profile details saved.')
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to save profile.')
  } finally {
    saving.value = false
  }
}

async function addCompleted() {
  if (!selectedCourseId.value) return ElMessage.warning('Select a course first.')
  completedLoading.value = true
  try {
    const record = await markCourseCompleted(selectedCourseId.value)
    completed.value.push(record)
    selectedCourseId.value = null
    showSavedFeedback(`${record.course.code} was added to your completed courses.`)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to add completed course.')
  } finally {
    completedLoading.value = false
  }
}

async function removeCompleted(record) {
  try {
    await ElMessageBox.confirm(`Remove ${record.course.code} from completed courses?`, 'Remove completed course', {
      confirmButtonText: 'Remove', cancelButtonText: 'Keep course',
    })
    await unmarkCourseCompleted(record.courseId)
    completed.value = completed.value.filter((item) => item.courseId !== record.courseId)
    showSavedFeedback(`${record.course.code} was removed from your completed courses.`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to remove completed course.')
  }
}

onMounted(() => {
  loadPage()
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  clearTimeout(feedbackTimer)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onBeforeRouteLeave(async () => {
  if (!hasUnsavedChanges.value) return true
  try {
    await ElMessageBox.confirm('You have unsaved profile changes. Leave this page without saving?', 'Unsaved changes', {
      confirmButtonText: 'Leave page', cancelButtonText: 'Keep editing',
    })
    return true
  } catch {
    return false
  }
})
</script>

<template>
  <section v-loading="loading" class="profile-page">
    <transition name="feedback-rise">
      <div v-if="saveFeedback" class="page-feedback" role="status">{{ saveFeedback }}</div>
    </transition>

    <template v-if="profile">
      <header class="page-heading">
        <div>
          <p class="eyebrow">YOUR ACCOUNT</p>
          <h1>Profile</h1>
          <p>{{ authStore.isStudent ? 'Manage your personal details and keep your completed course record current.' : 'Manage your account details.' }}</p>
        </div>
        <el-tag class="profile-role" size="large" effect="plain">{{ profile.role }}</el-tag>
      </header>

      <div class="profile-layout">
        <el-card class="profile-details-card" shadow="never">
          <template #header>
            <div class="card-heading">
              <div><span>ACCOUNT DETAILS</span><h2>Profile details</h2></div>
            </div>
          </template>

          <el-form label-position="top" class="profile-form">
            <el-form-item label="Preferred name">
              <el-input v-model="form.name" maxlength="80" />
            </el-form-item>
            <el-form-item label="Email address">
              <el-input :model-value="profile.email" disabled />
              <p class="field-note">Your sign-in email cannot be changed here.</p>
            </el-form-item>
            <el-form-item v-if="authStore.isStudent" label="Major or programme">
              <el-input v-model="form.major" placeholder="e.g. Computer Science" maxlength="120" />
            </el-form-item>
            <el-form-item v-if="authStore.isStudent" label="Current study year">
              <el-select v-model="form.studyYear" clearable placeholder="Select study year" style="width:100%">
                <el-option v-for="year in [1, 2, 3, 4, 5]" :key="year" :label="`Year ${year}`" :value="year" />
              </el-select>
            </el-form-item>
            <template v-if="authStore.isStudent">
              <div class="form-section-heading">
                <span>PERSONALISATION</span>
                <h3>Goals and interests</h3>
                <p>Add a short phrase, then press Enter. These details help tailor AI recommendations.</p>
              </div>
              <el-form-item label="Interests">
                <KeywordTagInput
                  v-model="form.interests"
                  :vocabulary="INTEREST_KEYWORDS"
                  placeholder="e.g. machine learning, web development"
                />
              </el-form-item>
              <el-form-item label="Study goals">
                <KeywordTagInput
                  v-model="form.goals"
                  :vocabulary="GOAL_KEYWORDS"
                  placeholder="e.g. prepare for a software engineering role"
                />
              </el-form-item>

              <div class="form-section-heading planning-heading">
                <span>PLANNING PREFERENCES</span>
                <h3>Preferred study pattern</h3>
              </div>
              <div class="preference-grid">
                <el-form-item label="Maximum credits per semester">
                  <el-input v-model.number="form.planningPreferences.maxCreditsPerSemester" type="number" min="15" max="120" step="15" clearable placeholder="No limit" />
                </el-form-item>
                <el-form-item label="Preferred workload">
                  <el-select v-model="form.planningPreferences.preferredWorkload" clearable placeholder="No preference" style="width:100%">
                    <el-option label="Light" value="LIGHT" />
                    <el-option label="Moderate" value="MODERATE" />
                    <el-option label="Intensive" value="INTENSIVE" />
                  </el-select>
                </el-form-item>
              </div>
              <el-form-item class="assessment-preference" label="Preferred assessment types">
                <el-select v-model="form.planningPreferences.preferredAssessmentTypes" multiple clearable placeholder="No preference" style="width:100%">
                  <el-option v-for="type in assessmentOptions" :key="type" :label="type.toLowerCase().replace('_', ' ')" :value="type" />
                </el-select>
              </el-form-item>
              <div class="exam-preference">
                <div><strong>Avoid exam-heavy courses</strong><span>Use this preference when generating AI recommendations.</span></div>
                <el-switch v-model="form.planningPreferences.avoidExamHeavy" />
              </div>
            </template>
          </el-form>

          <div class="profile-save" :class="{ 'profile-save--dirty': hasUnsavedChanges }">
            <p><span class="status-dot" />{{ hasUnsavedChanges ? 'Unsaved changes' : 'Profile is up to date' }}</p>
            <div>
              <el-button :disabled="!hasUnsavedChanges || saving" @click="resetChanges">Reset</el-button>
              <el-button type="primary" :loading="saving" :disabled="!hasUnsavedChanges" @click="saveProfile">Save</el-button>
            </div>
          </div>
        </el-card>

        <el-card v-if="authStore.isStudent" class="completed-card" shadow="never">
          <template #header>
            <div class="completed-heading">
              <div class="card-heading"><div><span>ACADEMIC RECORD</span><h2>Completed courses</h2></div></div>
              <div class="record-summary"><strong>{{ completed.length }}</strong><span>courses · {{ completedCredits }} credits</span></div>
            </div>
          </template>

          <el-input v-if="completed.length" v-model="completedQuery" clearable placeholder="Search completed courses" class="record-search" />

          <div class="completed-form">
            <el-select v-model="selectedCourseId" filterable :disabled="!availableCourses.length" :placeholder="availableCourses.length ? 'Choose a course from your Planner' : 'No planned courses available'" style="width:100%">
              <el-option v-for="course in availableCourses" :key="course.id" :label="`${course.code} · ${course.name}`" :value="course.id" />
            </el-select>
            <el-button type="primary" :loading="completedLoading" :disabled="!selectedCourseId" @click="addCompleted">Add</el-button>
          </div>
          <p class="planner-source-note">Choose from courses already in your Planner. <router-link to="/planner">Manage Planner →</router-link></p>

          <div v-if="filteredCompleted.length" class="course-records">
            <article v-for="record in filteredCompleted" :key="record.courseId" class="course-record">
              <span class="course-code">{{ record.course.code }}</span>
              <div class="course-copy"><strong>{{ record.course.name }}</strong><span>{{ record.course.credits }} credits</span></div>
              <el-button link class="remove-course" aria-label="Remove completed course" @click="removeCompleted(record)">Remove</el-button>
            </article>
          </div>
          <el-empty v-else-if="completed.length" description="No completed courses match your search" :image-size="70" />
          <el-empty v-else description="No completed courses recorded" :image-size="76" />
        </el-card>
      </div>
    </template>
  </section>
</template>

<style scoped>
.profile-page { max-width: 1080px; min-height: 420px; margin: 0 auto; }
.page-feedback { position: fixed; top: 78px; left: 50%; z-index: 120; transform: translateX(-50%); padding: 10px 16px; border: 1px solid var(--accent-border); border-radius: 10px; color: var(--accent); background: var(--accent-bg); box-shadow: 0 10px 30px rgba(50, 37, 79, .13); font-size: 13px; font-weight: 650; }
.feedback-rise-enter-active, .feedback-rise-leave-active { transition: opacity .2s ease, transform .2s ease; }
.feedback-rise-enter-from, .feedback-rise-leave-to { opacity: 0; transform: translate(-50%, -8px); }

.page-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.page-heading h1 { margin: 6px 0 8px; }
.page-heading > div > p:last-child { max-width: 640px; color: var(--text); }
.eyebrow { color: var(--accent); font: 700 11px/1.4 var(--mono); letter-spacing: .13em; }
.profile-role { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.profile-layout { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; align-items: stretch; }

.profile-details-card, .completed-card { height: 100%; border-top: 4px solid var(--accent); background: rgba(255, 255, 255, .88); }
.form-section-heading { margin: 26px 0 16px; padding-top: 22px; border-top: 1px solid var(--border); }
.form-section-heading span { color: var(--accent); font: 700 10px/1.3 var(--mono); letter-spacing: .12em; }
.form-section-heading h3 { margin: 4px 0; font-size: 18px; }
.form-section-heading p { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.planning-heading { margin-top: 22px; }
.preference-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.exam-preference { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: 4px 0 18px; padding: 13px 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
.exam-preference > div { display: grid; gap: 2px; }
.exam-preference strong { color: var(--text-h); font-size: 14px; }
.exam-preference span { color: var(--text-muted); font-size: 12px; }
.profile-details-card:only-child { grid-column: 1 / -1; }
.profile-details-card :deep(.el-card__header), .completed-card :deep(.el-card__header) { padding: 20px 22px; }
.profile-details-card :deep(.el-card__body), .completed-card :deep(.el-card__body) { padding: 22px; }
.card-heading span { color: var(--accent); font: 700 10px/1.35 var(--mono); letter-spacing: .13em; }
.card-heading h2 { margin-top: 4px; font-size: 22px; }
.profile-form :deep(.el-form-item:last-child) { margin-bottom: 0; }
.field-note { margin: 7px 2px 0; color: var(--text-muted); font-size: 11px; line-height: 1.4; }

.profile-save { margin: 22px -22px -22px; padding: 16px 22px; border-top: 1px solid var(--border); background: var(--bg); }
.profile-save, .profile-save > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.profile-save p { display: inline-flex; align-items: center; gap: 9px; color: var(--text); font-size: 12px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px var(--accent-bg); }
.profile-save--dirty { background: var(--accent-bg); }
.profile-save--dirty .status-dot { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-bg); }

.completed-heading { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.record-summary { flex: 0 0 auto; text-align: right; }
.record-summary strong { display: block; color: var(--text-h); font-size: 20px; line-height: 1.2; }
.record-summary span { color: var(--text-muted); font-size: 11px; }
.record-search { margin-bottom: 14px; }
.completed-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; padding: 13px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg); }
.planner-source-note { margin: 8px 2px 18px; color: var(--text-muted); font-size: 12px; }
.planner-source-note a { font-weight: 650; }
.course-records { border-top: 1px solid var(--border); }
.course-record { display: grid; grid-template-columns: 100px minmax(0, 1fr) auto; align-items: center; gap: 14px; padding: 15px 2px; border-bottom: 1px solid var(--border-light); }
.course-record:last-child { border-bottom: 0; }
.course-code { justify-self: start; padding: 4px 7px; border-radius: 6px; color: var(--accent); background: var(--accent-bg); font: 700 11px/1.3 var(--mono); }
.course-copy { display: flex; min-width: 0; flex-direction: column; }
.course-copy strong { overflow: hidden; color: var(--text-h); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.course-copy span { color: var(--text-muted); font-size: 12px; }
.remove-course { color: var(--accent); }

@media (max-width: 900px) {
  .profile-layout { grid-template-columns: 1fr; }
  .profile-form { display: grid; grid-template-columns: 1fr 1fr; column-gap: 16px; }
  .form-section-heading, .preference-grid, .assessment-preference, .exam-preference { grid-column: 1 / -1; }
}

@media (max-width: 680px) {
  .preference-grid { grid-template-columns: 1fr; }
  .page-heading { align-items: flex-start; flex-direction: column; }
  .profile-form { grid-template-columns: 1fr; }
  .completed-heading { align-items: flex-start; flex-direction: column; }
  .record-summary { text-align: left; }
  .completed-form { grid-template-columns: 1fr; }
  .completed-form .el-button { justify-self: start; }
  .course-record { grid-template-columns: 88px minmax(0, 1fr) auto; gap: 10px; }
}

@media (max-width: 460px) {
  .profile-save { align-items: stretch; flex-direction: column; }
  .profile-save > div { justify-content: flex-end; }
  .course-record { grid-template-columns: 1fr auto; }
  .course-code, .course-copy { grid-column: 1; }
  .course-record .el-button { grid-column: 2; grid-row: 1 / span 2; }
}
</style>
