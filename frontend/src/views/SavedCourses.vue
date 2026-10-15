<script setup>

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCourseReviews } from '../api/reviews'
import { normalizeSemesters } from '../utils/semesters'
import { useSavedStore } from '../stores/saved'
import { usePlannerStore } from '../stores/planner'
import { courseDetailLocation } from '../utils/courseNavigation'

const router = useRouter()
const route = useRoute()
const savedStore = useSavedStore()
const plannerStore = usePlannerStore()

const loading = ref(false)
const savedCourses = ref([])
const removingIds = ref(new Set())

const exportDialogVisible = ref(false)
const exportSelectedIds = ref(new Set())
const exporting = ref(false)
const exportingPlanId = ref(null)
const plansLoading = ref(false)

const hasCourses = computed(() => savedCourses.value.length > 0)

const totalCredits = computed(() => savedCourses.value.reduce((sum, c) => sum + (c.credits || 0), 0))
const totalHours = computed(() => savedCourses.value.reduce((sum, c) => sum + (c.workloadHours || 0), 0))
const avgRating = computed(() => {
  const rated = savedCourses.value.filter((c) => c.avgRating && c.avgRating !== '—')
  if (!rated.length) return '—'
  return (rated.reduce((sum, c) => sum + Number(c.avgRating), 0) / rated.length).toFixed(1)
})

async function loadSavedCourses() {
  loading.value = true
  try {
    await savedStore.loadSaved({ force: true })
    const results = await Promise.all(
      savedStore.courses.map(async (course) => {
        try {
          const reviews = await getCourseReviews(course.id)
          const avg = reviews.length
            ? (reviews.reduce((sum, r) => sum + r.overallRating, 0) / reviews.length).toFixed(1)
            : '—'
          return { ...course, avgRating: avg, reviewCount: reviews.length }
        } catch {
          return { ...course, avgRating: '—', reviewCount: 0 }
        }
      })
    )
    savedCourses.value = results.filter(Boolean)
  } catch (err) {
    ElMessage.error('Failed to load saved courses')
  } finally {
    loading.value = false
  }
}

async function handleRemove(courseId, courseName, event) {
  if (event) event.stopPropagation()
  const id = Number(courseId)
  if (removingIds.value.has(id)) return
  try {
    await ElMessageBox.confirm(`Remove "${courseName}" from saved courses?`, 'Confirm removal', { confirmButtonText: 'Remove', cancelButtonText: 'Cancel', type: 'warning' })
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error('Unable to confirm course removal')
    return
  }
  removingIds.value.add(id)
  try {
    await savedStore.removeSaved(id)
    savedCourses.value = savedCourses.value.filter((c) => c.id !== id)
    ElMessage.success(`Removed "${courseName}" from saved list`)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to remove course')
  } finally {
    removingIds.value.delete(id)
  }
}

function handleClearAll() {
  if (!hasCourses.value) return
  ElMessageBox.confirm(
    'Remove all saved courses? This action cannot be undone.',
    'Clear all',
    {
      confirmButtonText: 'Clear all',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(async () => {
      await savedStore.clearAll()
      savedCourses.value = []
      ElMessage.success('All saved courses removed')
    })
    .catch((error) => { if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to clear saved courses') })
}

function goToDetail(courseId) {
  router.push(courseDetailLocation(courseId, route, 'saved'))
}

async function openExportDialog() {
  exportSelectedIds.value = new Set(savedCourses.value.map((c) => c.id))
  plansLoading.value = true
  try {
    await plannerStore.loadPlans({ force: true })
    exportDialogVisible.value = true
  } catch (err) {
    ElMessage.error('Failed to load your plans')
  } finally {
    plansLoading.value = false
  }
}

function toggleExportSelection(courseId) {
  const id = Number(courseId)
  const next = new Set(exportSelectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  exportSelectedIds.value = next
}

function selectAllForExport() {
  if (exportSelectedIds.value.size === savedCourses.value.length) {
    exportSelectedIds.value = new Set()
  } else {
    exportSelectedIds.value = new Set(savedCourses.value.map((c) => c.id))
  }
}

async function exportToPlan(plan) {
  if (exporting.value) return
  if (!exportSelectedIds.value.size) {
    ElMessage.warning('Select at least one course to export')
    return
  }
  const coursesToExport = savedCourses.value.filter((c) => exportSelectedIds.value.has(Number(c.id)))
  exporting.value = true
  exportingPlanId.value = plan.id
  try {
    const result = await plannerStore.addCourses(plan.id, coursesToExport)
    if (result.added.length) {
      ElMessage.success(`Exported ${result.added.length} course(s) to ${plan.name}`)
    }
    if (result.skipped.length) {
      ElMessage.info(`${result.skipped.length} course(s) were already in ${plan.name} or could not be added, so they were skipped`)
    }
    exportDialogVisible.value = false
    router.push('/planner')
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Export failed')
  } finally {
    exporting.value = false
    exportingPlanId.value = null
  }
}

onMounted(loadSavedCourses)
</script>

<template>
  <section class="saved-page">
    <div class="page-header">
      <div class="header-text">
        <p class="eyebrow">SAVED COURSES</p>
        <h1>Your saved courses</h1>
        <p>Courses you have bookmarked for later comparison and planning.</p>
      </div>
      <div class="header-actions">
        <el-button v-if="hasCourses" plain @click="handleClearAll" class="clear-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          Clear all
        </el-button>
        <el-button v-if="hasCourses" type="success" plain @click="openExportDialog">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export to planner
        </el-button>
        <el-button type="primary" @click="router.push('/courses')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Browse courses
        </el-button>
      </div>
    </div>

    <div v-if="hasCourses" class="stats-bar">
      <div class="stat-card">
        <div class="stat-icon stat-icon--purple">📚</div>
        <div class="stat-info">
          <span class="stat-number">{{ savedCourses.length }}</span>
          <span class="stat-label">Saved courses</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--teal">🎓</div>
        <div class="stat-info">
          <span class="stat-number">{{ totalCredits }}</span>
          <span class="stat-label">Total credits</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--orange">⏱️</div>
        <div class="stat-info">
          <span class="stat-number">{{ totalHours }}</span>
          <span class="stat-label">Study hours</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon--pink">⭐</div>
        <div class="stat-info">
          <span class="stat-number">{{ avgRating }}</span>
          <span class="stat-label">Avg rating</span>
        </div>
      </div>
    </div>

    <div v-loading="loading" class="course-list">
      <el-card
        v-for="course in savedCourses"
        :key="course.id"
        shadow="hover"
        class="course-card"
        @click="goToDetail(course.id)"
      >

        <button
          class="quick-save-btn quick-save-btn--saved"
          :class="{ 'quick-save-btn--loading': removingIds.has(course.id) }"
          title="Remove from saved"
          @click="handleRemove(course.id, course.name, $event)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        <div class="card-content">
          <div class="course-main">
            <div class="course-top">
              <span class="course-code">{{ course.code }}</span>
              <span class="course-credits">{{ course.credits }} credits</span>
            </div>
            <h2 class="course-name text-clamp-1">{{ course.name }}</h2>
            <p class="course-desc text-clamp-2">{{ course.description || 'No description available' }}</p>
            <div class="course-meta">
              <div class="meta-item">
                <el-rate :model-value="Number(course.avgRating) || 0" disabled size="small" />
                <span class="meta-text">{{ course.avgRating }} ({{ course.reviewCount }} reviews)</span>
              </div>
              <div class="meta-item meta-item--hours">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {{ course.workloadHours || '—' }} hours
              </div>
              <div v-if="course.level" class="meta-item">
                Level {{ course.level }}
              </div>
            </div>
            <div v-if="normalizeSemesters(course.offeredSemesters).length" class="semester-tags">
              <el-tag
                v-for="sem in normalizeSemesters(course.offeredSemesters)"
                :key="sem"
                size="small"
                effect="plain"
              >
                {{ sem.replaceAll('_', ' ') }}
              </el-tag>
            </div>
          </div>
          <div class="card-actions" @click.stop>
            <el-button type="primary" plain size="small" @click="goToDetail(course.id)" class="action-btn">
              View details
            </el-button>
            <el-button type="danger" plain size="small" @click="handleRemove(course.id, course.name)" class="action-btn">
              Remove
            </el-button>
          </div>
        </div>
      </el-card>

      <div v-if="!loading && !hasCourses" class="empty-state">
        <div class="empty-icon">🔖</div>
        <h3>No saved courses yet</h3>
        <p>Browse the course catalogue and bookmark courses you are interested in. They will appear here for easy access.</p>
        <el-button type="primary" size="large" @click="router.push('/courses')">
          Browse Courses
        </el-button>
      </div>
    </div>

    <el-dialog
      v-model="exportDialogVisible"
      title="Export saved courses to planner"
      width="min(600px, 94vw)"
      :close-on-click-modal="false"
    >
      <div v-loading="plansLoading" class="export-dialog">

        <div class="export-section">
          <div class="export-section-header">
            <label class="export-label">Select courses to export ({{ exportSelectedIds.size }} selected)</label>
            <el-button link type="primary" size="small" @click="selectAllForExport">
              {{ exportSelectedIds.size === savedCourses.length ? 'Deselect all' : 'Select all' }}
            </el-button>
          </div>
          <div class="export-course-list">
            <label
              v-for="course in savedCourses"
              :key="course.id"
              class="export-course-item"
            >
              <el-checkbox
                :model-value="exportSelectedIds.has(course.id)"
                @change="toggleExportSelection(course.id)"
              />
              <div class="export-course-info">
                <span class="course-code">{{ course.code }}</span>
                <span class="course-name">{{ course.name }}</span>
              </div>
            </label>
          </div>
        </div>

        <div class="export-section">
          <label class="export-label">Export {{ exportSelectedIds.size }} selected course(s) to:</label>
          <div v-if="plannerStore.semesters.length" class="plan-actions">
            <el-button
              v-for="plan in plannerStore.semesters"
              :key="plan.id"
              class="plan-action"
              :loading="exportingPlanId === plan.id"
              :disabled="exporting || !exportSelectedIds.size"
              @click="exportToPlan(plan)"
            >
              <span class="plan-option-info">
                <strong>Export to {{ plan.name }}</strong>
                <small>{{ plan.year }} · {{ plan.semester.replaceAll('_', ' ') }} · {{ plan.courses?.length || 0 }} courses</small>
              </span>
            </el-button>
          </div>
          <el-empty v-else description="You do not have an existing planner yet" :image-size="64">
            <el-button type="primary" @click="exportDialogVisible = false; router.push('/planner')">Open Planner</el-button>
          </el-empty>
        </div>
      </div>

      <template #footer>
        <div class="export-footer">
          <el-button @click="exportDialogVisible = false">Cancel</el-button>
        </div>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.saved-page {
  max-width: 1080px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 28px;
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
  margin: 6px 0 8px;
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
  gap: 10px;
  flex-shrink: 0;
}

.clear-btn {
  display: inline-flex !important;
  align-items: center;
  gap: 6px;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 28px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 18px 20px;
  border: 1px solid var(--border-light);
  transition: all 0.25s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  font-size: 22px;
  flex-shrink: 0;
}

.stat-icon--purple { background: rgba(114, 81, 232, 0.12); }
.stat-icon--teal { background: rgba(62, 207, 176, 0.12); }
.stat-icon--orange { background: rgba(245, 158, 11, 0.12); }
.stat-icon--pink { background: rgba(239, 68, 68, 0.12); }

.stat-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-h);
  line-height: 1.2;
}

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  margin-top: 2px;
}

.course-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 200px;
}

.course-card {
  cursor: pointer;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  position: relative;
  border-radius: var(--radius-lg) !important;
}

.course-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-border);
}

.quick-save-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: all 0.2s ease;
  padding: 0;
}

.quick-save-btn:hover {
  color: var(--danger);
  border-color: var(--danger);
  background: rgba(239, 68, 68, 0.1);
  transform: scale(1.1);
}

.quick-save-btn--loading {
  opacity: 0.5;
  pointer-events: none;
}

.card-content {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  padding-right: 40px;
}

.course-main {
  flex: 1;
  min-width: 0;
}

.course-top {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.course-code {
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  background: var(--accent-bg);
  padding: 3px 10px;
  border-radius: 6px;
}

.course-credits {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
}

.course-name {
  margin: 0 0 8px;
  font-size: 19px;
  font-weight: 600;
  color: var(--text-h);
  line-height: 1.4;
}

.course-desc {
  color: var(--text);
  font-size: 14px;
  line-height: 1.6;
  margin: 0 0 12px;
}

.course-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-bottom: 10px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.meta-item--hours {
  font-weight: 500;
}

.meta-text {
  font-size: 13px;
  color: var(--text-muted);
}

.semester-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  min-width: 120px;
  flex-shrink: 0;
}

.action-btn {
  width: 100%;
}

.empty-state {
  text-align: center;
  padding: 80px 24px;
  background: var(--bg-card);
  border-radius: var(--radius-xl);
  border: 1px dashed var(--border);
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 8px;
}

.empty-state p {
  font-size: 15px;
  color: var(--text-muted);
  max-width: 420px;
  margin: 0 auto 24px;
  line-height: 1.6;
}

@media (max-width: 860px) {
  .stats-bar {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .card-content {
    flex-direction: column;
    padding-right: 0;
  }

  .card-actions {
    flex-direction: row;
    min-width: auto;
  }

  .action-btn {
    width: auto;
    flex: 1;
  }
}

@media (max-width: 560px) {
  .stats-bar {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .stat-card {
    padding: 14px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .stat-number {
    font-size: 20px;
  }

  .header-actions {
    width: 100%;
  }

  .header-actions .el-button {
    flex: 1;
  }
}

.export-dialog {
  max-height: 60vh;
  overflow-y: auto;
}

.export-section {
  margin-bottom: 20px;
}

.export-section:last-child {
  margin-bottom: 0;
}

.export-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-h);
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.export-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.plan-actions {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 10px;
}

.plan-action {
  width: 100%;
  height: auto;
  min-height: 54px;
  justify-content: flex-start;
  padding: 10px 14px;
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.plan-option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  text-align: left;
}

.plan-option-info strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
}

.plan-option-info small {
  font-size: 12px;
  color: var(--text-muted);
}

.export-course-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.export-course-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-light);
  cursor: pointer;
  transition: background 0.15s;
}

.export-course-item:last-child {
  border-bottom: none;
}

.export-course-item:hover {
  background: var(--accent-bg);
}

.export-course-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.export-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
