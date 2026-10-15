<script setup>

import { reactive, ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCourse } from '../api/courses'
import { usePlannerStore } from '../stores/planner'
import { useSavedStore } from '../stores/saved'
import { courseDetailLocation } from '../utils/courseNavigation'

const router = useRouter()
const route = useRoute()
const plannerStore = usePlannerStore()
const savedStore = useSavedStore()

const loading = ref(false)
const allCourses = computed(() => savedStore.courses)
const addDialogVisible = ref(false)
const planDialogVisible = ref(false)
const savingPlan = ref(false)
const selectedSemesterId = ref(null)
const searchQuery = ref('')
const selectedCourseIds = ref(new Set())
const batchAdding = ref(false)
const pendingCourse = ref(null)
const pendingCourseDialogVisible = ref(false)
const pendingSemesterId = ref(null)
const addingPendingCourse = ref(false)
const creatingForPendingCourse = ref(false)
const planForm = reactive({ name: '', year: new Date().getFullYear(), semester: 'SEMESTER_1' })

const CREDIT_WARNING_THRESHOLD = 60
const WORKLOAD_WARNING_THRESHOLD = 480

const filteredCourses = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return allCourses.value
  return allCourses.value.filter((course) =>
    [course.code, course.name, course.description].some((value) =>
      value?.toLowerCase().includes(keyword)
    )
  )
})

const totalCredits = computed(() => plannerStore.totalCredits)
const totalCourses = computed(() => plannerStore.semesters.reduce((sum, s) => sum + s.courses.length, 0))
const totalWorkload = computed(() => plannerStore.semesters.reduce((sum, s) => sum + s.courses.reduce((c, course) => c + (course.workloadHours || 0), 0), 0))

const semesterStats = computed(() => {
  return plannerStore.semesters.map((sem) => ({
    ...sem,
    credits: sem.courses.reduce((sum, c) => sum + (c.credits || 0), 0),
    workload: sem.courses.reduce((sum, c) => sum + (c.workloadHours || 0), 0),
    overloaded: sem.courses.reduce((sum, c) => sum + (c.workloadHours || 0), 0) > WORKLOAD_WARNING_THRESHOLD,
    creditHeavy: sem.courses.reduce((sum, c) => sum + (c.credits || 0), 0) > CREDIT_WARNING_THRESHOLD,
  }))
})

const availableToAdd = computed(() => filteredCourses.value.filter((c) => !plannerStore.isInPlanner(c.id, selectedSemesterId.value)))
const selectedCount = computed(() => selectedCourseIds.value.size)

async function loadCourses() {
  loading.value = true
  try {
    await Promise.all([
      savedStore.loadSaved({ force: true }),
      plannerStore.loadPlans({ force: true }),
    ])
    await openPendingCourseDialog()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Failed to load saved courses and plans')
  } finally {
    loading.value = false
  }
}

function clearPendingCourseRequest() {
  const query = { ...route.query }
  delete query.courseId
  pendingCourse.value = null
  pendingSemesterId.value = null
  creatingForPendingCourse.value = false
  if (route.query.courseId) router.replace({ query })
}

async function openPendingCourseDialog() {
  const courseId = Number(route.query.courseId)
  if (!Number.isInteger(courseId) || courseId <= 0) return

  try {
    pendingCourse.value = await getCourse(courseId)
    pendingSemesterId.value = plannerStore.semesters[0]?.id ?? null
    pendingCourseDialogVisible.value = true
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to load the selected course')
    clearPendingCourseRequest()
  }
}

async function addPendingCourseToSemester() {
  if (!pendingCourse.value || !pendingSemesterId.value) {
    ElMessage.warning('Choose a semester first')
    return
  }
  const semesterName = getSemesterName(pendingSemesterId.value)
  addingPendingCourse.value = true
  try {
    const result = await addCourseWithPrerequisiteConfirmation(pendingSemesterId.value, pendingCourse.value)
    if (result.cancelled) return
    if (result.added) {
      ElMessage.success(`${pendingCourse.value.code} added to ${semesterName}`)
      pendingCourseDialogVisible.value = false
      clearPendingCourseRequest()
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to add the course to this semester')
  } finally {
    addingPendingCourse.value = false
  }
}

async function addCourseWithPrerequisiteConfirmation(semesterId, course) {
  let result = await plannerStore.addCourse(semesterId, course, { confirmPrerequisites: false })
  if (!result.requiresConfirmation) return result

  try {
    await ElMessageBox.confirm(
      `${result.warnings.join('\n')}\n\nDo you want to add this course anyway?`,
      'Prerequisite warning',
      { confirmButtonText: 'Add anyway', cancelButtonText: 'Cancel', type: 'warning' },
    )
  } catch (error) {
    if (error === 'cancel' || error === 'close') return { ...result, cancelled: true }
    throw error
  }

  result = await plannerStore.addCourse(semesterId, course, { confirmPrerequisites: true })
  return result
}

function createSemesterForPendingCourse() {
  pendingCourseDialogVisible.value = false
  creatingForPendingCourse.value = true
  addSemester()
}

function handlePlanDialogClosed() {
  if (creatingForPendingCourse.value && !savingPlan.value) clearPendingCourseRequest()
}

async function openAddDialog(semesterId) {
  selectedSemesterId.value = semesterId
  searchQuery.value = ''
  selectedCourseIds.value = new Set()
  loading.value = true
  try {
    await savedStore.loadSaved({ force: true })
    addDialogVisible.value = true
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to load your saved courses')
  } finally {
    loading.value = false
  }
}

function toggleCourseSelection(courseId) {
  const id = Number(courseId)
  const next = new Set(selectedCourseIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedCourseIds.value = next
}

function isSelected(courseId) {
  return selectedCourseIds.value.has(Number(courseId))
}

function selectAllAvailable() {
  if (selectedCount.value === availableToAdd.value.length && availableToAdd.value.length > 0) {
    selectedCourseIds.value = new Set()
  } else {
    selectedCourseIds.value = new Set(availableToAdd.value.map((c) => c.id))
  }
}

async function confirmAddCourses() {
  if (!selectedCount.value) {
    ElMessage.warning('Select at least one course to add')
    return
  }
  const semName = getSemesterName(selectedSemesterId.value)
  const coursesToAdd = allCourses.value.filter((c) => selectedCourseIds.value.has(Number(c.id)))
  batchAdding.value = true
  try {
    const result = { added: [], skipped: [], warnings: [] }
    for (const course of coursesToAdd) {
      const courseResult = await addCourseWithPrerequisiteConfirmation(selectedSemesterId.value, course)
      if (courseResult.cancelled || !courseResult.added) {
        result.skipped.push(course)
        continue
      }
      result.added.push(course)
      if (courseResult.warnings?.length) result.warnings.push(...courseResult.warnings)
    }
    if (result.added.length) {
      ElMessage.success(`Added ${result.added.length} course(s) to ${semName}`)
    }
    if (result.skipped.length) {
      ElMessage.info(`${result.skipped.length} course(s) already in plan, skipped`)
    }
    if (result.warnings.length) {
      ElMessage.warning(result.warnings.join(' '))
    }
    addDialogVisible.value = false
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Failed to add courses')
  } finally {
    batchAdding.value = false
  }
}

function isCourseInPlanner(courseId) {
  return plannerStore.isInPlanner(courseId, selectedSemesterId.value)
}

function getSemesterName(semesterId) {
  const sem = plannerStore.semesters.find((s) => s.id === semesterId)
  return sem ? sem.name : 'Unknown semester'
}

function removeCourse(semesterId, courseId, courseName) {
  ElMessageBox.confirm(
    `Remove "${courseName}" from ${getSemesterName(semesterId)}?`,
    'Remove course',
    {
      confirmButtonText: 'Remove',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(async () => {
      await plannerStore.removeCourse(semesterId, courseId)
      ElMessage.success('Course removed')
    })
    .catch((error) => { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to remove course') })
}

function addSemester() {
  Object.assign(planForm, { name: `Plan ${plannerStore.semesters.length + 1}`, year: new Date().getFullYear(), semester: 'SEMESTER_1' })
  planDialogVisible.value = true
}

async function createSemester() {
  if (!planForm.name.trim()) return ElMessage.warning('Enter a plan name')
  savingPlan.value = true
  try {
    const newPlan = await plannerStore.addSemester({ ...planForm, name: planForm.name.trim() })
    planDialogVisible.value = false
    if (creatingForPendingCourse.value && pendingCourse.value) {
      try {
        const result = await addCourseWithPrerequisiteConfirmation(newPlan.id, pendingCourse.value)
        if (result.cancelled) {
          pendingSemesterId.value = newPlan.id
          pendingCourseDialogVisible.value = true
          return
        }
        if (result.added) {
          ElMessage.success(`${pendingCourse.value.code} added to ${newPlan.name}`)
          clearPendingCourseRequest()
        }
      } catch (err) {
        creatingForPendingCourse.value = false
        pendingSemesterId.value = newPlan.id
        pendingCourseDialogVisible.value = true
        ElMessage.error(err.response?.data?.message || 'Semester created, but the course could not be added. Please try again.')
      }
    } else {
      ElMessage.success('Semester plan created')
    }
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to create plan')
  } finally {
    savingPlan.value = false
  }
}

function removeSemester(semesterId, semesterName) {
  const sem = plannerStore.semesters.find((s) => s.id === semesterId)
  if (sem?.courses.length) {
    ElMessageBox.confirm(
      `${semesterName} contains ${sem.courses.length} course(s). Remove this semester?`,
      'Remove semester',
      {
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        type: 'warning',
      }
    )
      .then(async () => {
        await plannerStore.removeSemester(semesterId)
        ElMessage.success('Semester removed')
      })
      .catch((error) => { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to remove plan') })
  } else {
    ElMessageBox.confirm(`${semesterName} is empty. Remove this semester?`, 'Remove semester', { confirmButtonText: 'Remove', cancelButtonText: 'Cancel', type: 'warning' })
      .then(() => plannerStore.removeSemester(semesterId))
      .catch((error) => { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to remove plan') })
  }
}

function clearPlan() {
  ElMessageBox.confirm(
    'Clear all planned courses? This action cannot be undone.',
    'Clear plan',
    {
      confirmButtonText: 'Clear all',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(async () => {
      await plannerStore.clearAll()
      ElMessage.success('Plan cleared')
    })
    .catch((error) => { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to clear plans') })
}

function goToCourseDetail(courseId) {
  router.push(courseDetailLocation(courseId, route, 'planner'))
}

onMounted(loadCourses)
</script>

<template>
  <section class="planner-page">
    <div class="page-header">
      <div class="header-text">
        <p class="eyebrow">SEMESTER PLANNER</p>
        <h1>Plan your degree pathway</h1>
        <p>Arrange courses across semesters, track credits and check workload balance.</p>
      </div>
      <div class="header-actions">
        <el-button plain @click="clearPlan" :disabled="!totalCourses">Clear plan</el-button>
        <el-button type="primary" @click="router.push('/saved')">
          🔖 My saved courses
        </el-button>
      </div>
    </div>

    <div class="overview-bar">
      <div class="overview-item">
        <div class="overview-icon overview-icon--purple">📚</div>
        <div class="overview-data">
          <span class="overview-number">{{ plannerStore.semesters.length }}</span>
          <span class="overview-label">Semesters</span>
        </div>
      </div>
      <div class="overview-item">
        <div class="overview-icon overview-icon--teal">🎓</div>
        <div class="overview-data">
          <span class="overview-number">{{ totalCredits }}</span>
          <span class="overview-label">Total credits</span>
        </div>
      </div>
      <div class="overview-item">
        <div class="overview-icon overview-icon--orange">📋</div>
        <div class="overview-data">
          <span class="overview-number">{{ totalCourses }}</span>
          <span class="overview-label">Planned courses</span>
        </div>
      </div>
      <div class="overview-item">
        <div class="overview-icon overview-icon--pink">⏱️</div>
        <div class="overview-data">
          <span class="overview-number">{{ totalWorkload }}</span>
          <span class="overview-label">Study hours</span>
        </div>
      </div>
    </div>

    <el-alert
      v-if="plannerStore.semesters.some(s => s.courses.reduce((sum, c) => sum + (c.workloadHours || 0), 0) > WORKLOAD_WARNING_THRESHOLD)"
      type="warning"
      :closable="false"
      show-icon
      class="workload-alert"
      title="Workload warning"
    >
      One or more semesters exceed {{ WORKLOAD_WARNING_THRESHOLD }} study hours. Consider balancing your course load.
    </el-alert>

    <el-card v-if="savedStore.savedCount > 0 && !totalCourses" class="hint-card" shadow="never">
      <div class="hint-content">
        <span class="hint-icon">💡</span>
        <div>
          <strong>You have {{ savedStore.savedCount }} saved course(s).</strong>
          <span> Add a semester below, then click "Add courses" to import them into your plan.</span>
        </div>
      </div>
    </el-card>

    <div class="semesters-container">
      <div
        v-for="sem in semesterStats"
        :key="sem.id"
        class="semester-card"
        :class="{ 'semester-card--warning': sem.overloaded || sem.creditHeavy }"
      >
        <div class="semester-header">
          <div class="semester-title">
            <h2>{{ sem.name }}</h2>
            <span class="semester-stats">
              {{ sem.year }} · {{ sem.semester.replaceAll('_', ' ') }}
            </span>
          </div>
          <el-button
            link
            type="danger"
            size="small"
            @click="removeSemester(sem.id, sem.name)"
          >
            Remove
          </el-button>
        </div>

        <div class="semester-progress">
          <div class="progress-row">
            <span class="progress-label">Credits</span>
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="{ 'progress-fill--warning': sem.creditHeavy }"
                :style="{ width: `${Math.min(100, (sem.credits / CREDIT_WARNING_THRESHOLD) * 100)}%` }"
              ></div>
            </div>
            <span class="progress-value">{{ sem.credits }} pts</span>
          </div>
          <div class="progress-row">
            <span class="progress-label">Workload</span>
            <div class="progress-bar">
              <div
                class="progress-fill progress-fill--teal"
                :class="{ 'progress-fill--warning': sem.overloaded }"
                :style="{ width: `${Math.min(100, (sem.workload / WORKLOAD_WARNING_THRESHOLD) * 100)}%` }"
              ></div>
            </div>
            <span class="progress-value">{{ sem.workload }}h</span>
          </div>
        </div>

        <div class="semester-courses">
          <div
            v-for="course in sem.courses"
            :key="course.id"
            class="planned-course"
          >
            <div class="course-info" @click="goToCourseDetail(course.id)">
              <span class="course-code">{{ course.code }}</span>
              <span class="course-name">{{ course.name }}</span>
            </div>
            <div class="course-actions">
              <span class="course-credits">{{ course.credits }} pts</span>
              <el-button
                link
                type="danger"
                size="small"
                @click="removeCourse(sem.id, course.id, course.name)"
              >
                ×
              </el-button>
            </div>
          </div>

          <el-empty
            v-if="!sem.courses.length"
            description="No courses planned yet"
            :image-size="60"
          />
        </div>

        <el-button
          type="primary"
          plain
          class="add-course-btn"
          @click="openAddDialog(sem.id)"
        >
          + Add courses
        </el-button>
      </div>

      <div class="add-semester-card" @click="addSemester">
        <div class="add-icon">+</div>
        <span>Add semester</span>
      </div>
    </div>

    <el-dialog
      v-model="pendingCourseDialogVisible"
      title="Choose a semester"
      width="min(520px, 94vw)"
      :close-on-click-modal="false"
      @closed="!creatingForPendingCourse && clearPendingCourseRequest()"
    >
      <template v-if="pendingCourse">
        <div class="pending-course-summary">
          <span class="course-code">{{ pendingCourse.code }}</span>
          <div>
            <strong>{{ pendingCourse.name }}</strong>
            <p>{{ pendingCourse.credits }} credits · {{ pendingCourse.workloadHours || '—' }}h workload</p>
          </div>
        </div>

        <el-radio-group v-if="plannerStore.semesters.length" v-model="pendingSemesterId" class="semester-picker">
          <el-radio v-for="sem in semesterStats" :key="sem.id" :value="sem.id" border>
            <span class="semester-option-name">{{ sem.name }}</span>
            <span class="semester-option-meta">{{ sem.year }} · {{ sem.semester.replaceAll('_', ' ') }} · {{ sem.credits }} pts</span>
          </el-radio>
        </el-radio-group>
        <el-empty v-else description="Create a semester before adding this course" :image-size="70" />
      </template>

      <template #footer>
        <el-button @click="pendingCourseDialogVisible = false">Cancel</el-button>
        <el-button v-if="!plannerStore.semesters.length" type="primary" @click="createSemesterForPendingCourse">
          Create semester
        </el-button>
        <el-button
          v-else
          type="primary"
          :loading="addingPendingCourse"
          :disabled="!pendingSemesterId"
          @click="addPendingCourseToSemester"
        >
          Add to semester
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="addDialogVisible"
      title="Add courses to semester"
      width="min(640px, 94vw)"
      :close-on-click-modal="false"
    >
      <div class="dialog-header">
        <el-input
          v-model="searchQuery"
          clearable
          placeholder="Search by course code, name or keyword"
          class="dialog-search"
        >
          <template #prefix>⌕</template>
        </el-input>
        <el-button
          link
          type="primary"
          size="small"
          @click="selectAllAvailable"
          :disabled="!availableToAdd.length"
        >
          {{ selectedCount === availableToAdd.length && availableToAdd.length > 0 ? 'Deselect all' : 'Select all' }}
        </el-button>
      </div>

      <div class="selected-info" v-if="selectedCount">
        {{ selectedCount }} course(s) selected
      </div>

      <div v-loading="loading" class="course-picker">
        <label
          v-for="course in filteredCourses"
          :key="course.id"
          class="picker-item"
          :class="{
            disabled: isCourseInPlanner(course.id),
            selected: isSelected(course.id),
          }"
        >
          <input
            type="checkbox"
            class="picker-checkbox"
            :checked="isSelected(course.id)"
            :disabled="isCourseInPlanner(course.id)"
            @change="toggleCourseSelection(course.id)"
          />
          <div class="picker-info">
            <span class="course-code">{{ course.code }}</span>
            <span class="course-name">{{ course.name }}</span>
            <span class="course-meta">{{ course.credits }} credits · {{ course.workloadHours || '—' }}h</span>
          </div>
          <el-tag v-if="isCourseInPlanner(course.id)" type="info" size="small">In plan</el-tag>
        </label>
        <el-empty
          v-if="!loading && !filteredCourses.length"
          :description="allCourses.length ? 'No matching saved courses' : 'Save a course before adding it to a plan'"
        >
          <el-button v-if="!allCourses.length" type="primary" @click="addDialogVisible = false; router.push('/courses')">Browse and save courses</el-button>
        </el-empty>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="addDialogVisible = false">Cancel</el-button>
          <el-button
            type="primary"
            :loading="batchAdding"
            :disabled="!selectedCount"
            @click="confirmAddCourses"
          >
            Add {{ selectedCount ? `${selectedCount} course(s)` : '' }} to plan
          </el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="planDialogVisible"
      title="Create semester plan"
      width="min(480px, 94vw)"
      :close-on-click-modal="!savingPlan"
      :close-on-press-escape="!savingPlan"
      :show-close="!savingPlan"
      @closed="handlePlanDialogClosed"
    >
      <el-form label-position="top">
        <el-form-item label="Plan name"><el-input v-model="planForm.name" placeholder="e.g. Computer Science pathway" /></el-form-item>
        <div class="plan-form-row">
          <el-form-item label="Year"><el-input-number v-model="planForm.year" :min="2000" :max="2100" /></el-form-item>
          <el-form-item label="Teaching period"><el-select v-model="planForm.semester"><el-option label="Semester 1" value="SEMESTER_1" /><el-option label="Semester 2" value="SEMESTER_2" /><el-option label="Summer" value="SUMMER" /></el-select></el-form-item>
        </div>
      </el-form>
      <template #footer><el-button :disabled="savingPlan" @click="planDialogVisible = false">Cancel</el-button><el-button type="primary" :loading="savingPlan" @click="createSemester">Create plan</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.planner-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 24px;
}

.header-text {
  flex: 1;
  min-width: 0;
}

.eyebrow {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0;
  text-transform: uppercase;
}

.page-header h1 {
  margin: 6px 0;
  font-size: clamp(26px, 3.5vw, 38px);
  font-weight: 700;
}

.page-header p {
  color: var(--text);
  margin: 0;
  font-size: 15px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.overview-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  border: 1px solid var(--border-light);
  transition: all 0.25s ease;
}

.overview-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.overview-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 22px;
  flex-shrink: 0;
}

.overview-icon--purple { background: rgba(114, 81, 232, 0.12); }
.overview-icon--teal { background: rgba(62, 207, 176, 0.12); }
.overview-icon--orange { background: rgba(245, 158, 11, 0.12); }
.overview-icon--pink { background: rgba(239, 68, 68, 0.12); }

.overview-data {
  display: flex;
  flex-direction: column;
}

.overview-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-h);
  line-height: 1.2;
}

.overview-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.workload-alert {
  margin-bottom: 20px;
  border-radius: var(--radius) !important;
}

.hint-card {
  margin-bottom: 20px;
  border-radius: var(--radius-lg) !important;
  border: 1px dashed var(--accent-border) !important;
  background: var(--accent-bg) !important;
}

.hint-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.hint-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.hint-content strong {
  color: var(--text-h);
  display: block;
  margin-bottom: 2px;
}

.hint-content span {
  font-size: 14px;
  color: var(--text);
}

.semesters-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 20px;
}

.semester-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  transition: all 0.25s ease;
}

.semester-card:hover {
  box-shadow: var(--shadow);
}

.semester-card--warning {
  border-color: rgba(245, 158, 11, 0.4);
}

.semester-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}

.semester-title h2 {
  margin: 0 0 4px;
  font-size: 19px;
  color: var(--text-h);
  font-weight: 600;
}

.semester-stats {
  font-size: 13px;
  color: var(--text-muted);
}

.semester-progress {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-label {
  font-size: 12px;
  color: var(--text-muted);
  width: 60px;
  flex-shrink: 0;
  font-weight: 500;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.progress-fill--teal {
  background: var(--secondary);
}

.progress-fill--warning {
  background: var(--warning);
}

.progress-value {
  font-size: 12px;
  color: var(--text-h);
  font-weight: 600;
  width: 50px;
  text-align: right;
  flex-shrink: 0;
}

.semester-courses {
  flex: 1;
  min-height: 80px;
  margin-bottom: 16px;
}

.planned-course {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background: var(--accent-bg);
  border-radius: var(--radius-sm);
  margin-bottom: 8px;
  transition: background 0.2s;
}

.planned-course:hover {
  background: rgba(114, 81, 232, 0.15);
}

.course-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.course-info:hover .course-name {
  color: var(--accent);
}

.course-code {
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.course-name {
  font-size: 14px;
  color: var(--text-h);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}

.course-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.course-credits {
  font-size: 12px;
  color: var(--text-muted);
}

.add-course-btn {
  width: 100%;
}

.add-semester-card {
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  min-height: 200px;
  color: var(--text-muted);
}

.add-semester-card:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.add-icon {
  font-size: 36px;
  font-weight: 300;
  line-height: 1;
}

.dialog-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
}

.dialog-search {
  flex: 1;
}

.selected-info {
  font-size: 13px;
  color: var(--accent);
  font-weight: 600;
  margin-bottom: 10px;
}

.course-picker {
  max-height: 380px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.picker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.15s;
  margin: 0;
}

.picker-item:last-child {
  border-bottom: none;
}

.picker-item:hover:not(.disabled) {
  background: var(--accent-bg);
}

.picker-item.selected {
  background: var(--accent-bg);
}

.picker-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.picker-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
}

.picker-checkbox:disabled {
  cursor: not-allowed;
}

.picker-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.picker-info .course-name {
  font-size: 14px;
}

.course-meta {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.pending-course-summary {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  margin-bottom: 18px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  background: var(--accent-bg);
}

.pending-course-summary strong {
  color: var(--text-h);
}

.pending-course-summary p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 13px;
}

.semester-picker {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.semester-picker :deep(.el-radio) {
  width: 100%;
  height: auto;
  min-height: 54px;
  margin: 0;
  padding: 10px 14px;
}

.semester-picker :deep(.el-radio__label) {
  display: flex;
  flex-direction: column;
  gap: 3px;
  white-space: normal;
}

.semester-option-name {
  color: var(--text-h);
  font-weight: 600;
}

.semester-option-meta {
  color: var(--text-muted);
  font-size: 12px;
}

.plan-form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.plan-form-row :deep(.el-input-number), .plan-form-row :deep(.el-select) { width:100%; }

@media (max-width: 900px) {
  .overview-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
  }

  .semesters-container {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .overview-bar {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .overview-item {
    padding: 14px;
  }

  .overview-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .overview-number {
    font-size: 20px;
  }
}
</style>
