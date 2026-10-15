<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCourse } from '../api/courses'
import { normalizeSemesters } from '../utils/semesters'
import { buildReviewPayload, isWholeRating } from '../utils/reviewPayload'
import { getCourseReviews, getMyCourseReview, reportReview, submitReview, updateMyReview } from '../api/reviews'
import request from '../api/request'
import { useAuthStore } from '../stores/auth'
import { useSavedStore } from '../stores/saved'
import { detailBackLabel, safeReturnTarget } from '../utils/courseNavigation'
import { useNotificationStore } from '../stores/notifications'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const savedStore = useSavedStore()
const notificationStore = useNotificationStore()
const loading = ref(true)
const submitting = ref(false)
const saving = ref(false)
const error = ref('')
const course = ref(null)
const reviews = ref([])
const ownReview = ref(null)
const isGenerating = ref(false)
const summaryData = ref('')
const emptyReviewForm = () => ({ overallRating: 0, difficultyRating: 0, workloadRating: 0, teachingRating: 0, usefulnessRating: 0, assessmentStyle: '', comment: '' })
const form = reactive(emptyReviewForm())
const average = computed(() => reviews.value.length
  ? (reviews.value.reduce((total, item) => total + item.overallRating, 0) / reviews.value.length).toFixed(1)
  : '-')

const isSaved = computed(() => course.value ? savedStore.isSaved(course.value.id) : false)
const backLabel = computed(() => detailBackLabel(route.query.from))
const safeOfficialLink = computed(() => {
  try {
    const url = new URL(course.value?.officialLink)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
})

function goBack() {
  const target = safeReturnTarget(route.query.returnTo)
  router.push(target || { name: 'CourseList' })
}

function openRelatedCourse(courseId) {
  router.push({
    name: 'CourseDetail',
    params: { id: courseId },
    query: {
      ...(route.query.from ? { from: route.query.from } : {}),
      ...(safeReturnTarget(route.query.returnTo) ? { returnTo: safeReturnTarget(route.query.returnTo) } : {}),
    },
  })
}

function formatReviewDate(value) {
  if (!value) return 'Unknown date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function fillReviewForm(review) {
  Object.assign(form, emptyReviewForm())
  if (!review) return
  Object.assign(form, {
    overallRating: review.overallRating ?? 0,
    difficultyRating: review.difficultyRating ?? 0,
    workloadRating: review.workloadRating ?? 0,
    teachingRating: review.teachingRating ?? 0,
    usefulnessRating: review.usefulnessRating ?? 0,
    assessmentStyle: review.assessmentStyle || '',
    comment: review.comment || '',
  })
}

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    const requests = [
      getCourse(route.params.id),
      getCourseReviews(route.params.id),
      authStore.isStudent ? getMyCourseReview(route.params.id) : Promise.resolve(null),
      authStore.isStudent ? savedStore.loadSaved().catch(() => undefined) : Promise.resolve(),
    ]
    const [courseResult, reviewResults, myReview] = await Promise.all(requests)
    course.value = courseResult
    reviews.value = reviewResults
    ownReview.value = myReview
    fillReviewForm(myReview)
  } catch (err) {
    error.value = err.response?.data?.message || 'Course details cannot be loaded right now.'
  } finally {
    loading.value = false
  }
}

async function fetchAiSummary() {
  if (isGenerating.value) return
  if (!authStore.isLoggedIn) {
    ElMessage.warning('Please log in before generating an AI course summary.')
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  isGenerating.value = true
  try {
    const response = await request.get(`/ai/courses/${route.params.id}/summary`)
    if (response?.success) {
      summaryData.value = response.summary
      ElMessage.success('AI summary generated successfully')
    } else {
      ElMessage.warning(response?.message || 'No data available')
    }
  } catch (err) {
    ElMessage.error('The AI summary service is temporarily unavailable.')
  } finally {
    isGenerating.value = false
  }
}

async function handleReview() {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  if (![form.overallRating, form.difficultyRating, form.workloadRating].every(value => isWholeRating(value, { required: true }))) {
    ElMessage.warning('Please complete all three ratings.')
    return
  }
  submitting.value = true
  try {
    const wasEditing = Boolean(ownReview.value)
    const updated = wasEditing
      ? await updateMyReview(route.params.id, buildReviewPayload(form))
      : await submitReview({ courseId: Number(route.params.id), ...buildReviewPayload(form) })
    ownReview.value = updated
    await notificationStore.refresh().catch(() => {})
    reviews.value = reviews.value.filter((review) => review.id !== updated.id)
    ElMessage.success(`Your review was ${wasEditing ? 'saved' : 'submitted'} and is pending approval.`)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Submission failed. Please try again later.')
  } finally {
    submitting.value = false
  }
}

async function toggleSaved() {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  if (saving.value) return
  saving.value = true
  try {
    const saved = await savedStore.toggleSave(course.value.id)
    ElMessage.success(saved ? 'Added to saved courses' : 'Removed from saved courses')
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to update saved courses')
  } finally {
    saving.value = false
  }
}

async function handleReport(review) {
  if (!authStore.isLoggedIn) {
    router.push({ name: 'Login', query: { redirect: route.fullPath } })
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('Explain why this review should be checked by a moderator.', 'Report review', {
      confirmButtonText: 'Submit report', cancelButtonText: 'Cancel', inputType: 'textarea',
      inputValidator: (text) => Boolean(text?.trim()) || 'Please enter a reason',
    })
    await reportReview(review.id, value)
    await notificationStore.refresh().catch(() => {})
    ElMessage.success('Report submitted to the moderation team.')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(error.response?.data?.message || 'Unable to report review')
  }
}

onMounted(loadPage)
watch(() => route.params.id, () => {
  summaryData.value = ''
  ownReview.value = null
  fillReviewForm(null)
  loadPage()
})
</script>

<template>
  <section v-loading="loading" class="detail-page">
    <el-result v-if="error" icon="warning" title="Course unavailable" :sub-title="error">
      <template #extra><el-button @click="loadPage">Try again</el-button></template>
    </el-result>

    <template v-else-if="course">

      <button class="back-link" @click="goBack">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        {{ backLabel }}
      </button>

      <div class="course-hero">
        <div class="hero-info">
          <div class="hero-tags">
            <span class="course-code">{{ course.code }}</span>
            <el-tag v-if="course.level" size="small" effect="plain" type="info">Level {{ course.level }}</el-tag>
            <el-tag v-for="sem in normalizeSemesters(course.offeredSemesters)" :key="sem" size="small" effect="plain">
              {{ sem.replaceAll('_', ' ') }}
            </el-tag>
          </div>
          <h1 class="course-title">{{ course.name }}</h1>
          <p class="course-desc">{{ course.description || 'No course description is available.' }}</p>

          <div class="hero-actions">
            <el-button
              v-if="!authStore.isLoggedIn || authStore.isStudent"
              :type="isSaved ? 'warning' : 'primary'"
              size="large"
              :loading="saving"
              class="save-action-btn"
              @click="toggleSaved"
            >
              <template v-if="isSaved">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                Saved
              </template>
              <template v-else>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                Save course
              </template>
            </el-button>
            <el-button size="large" plain @click="router.push({ name: 'CompareCourses', query: { courseId: course.id } })">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Compare
            </el-button>
            <el-button v-if="!authStore.isLoggedIn || authStore.isStudent" size="large" plain @click="router.push({ name: 'Planner', query: { courseId: course.id } })">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Add to planner
            </el-button>
          </div>
        </div>

        <div class="rating-sidebar">
          <div class="rating-card">
            <div class="rating-score">
              <span class="rating-number">{{ average }}</span>
              <span class="rating-max">/ 5</span>
            </div>
            <el-rate :model-value="Number(average) || 0" disabled size="small" />
            <div class="rating-count">{{ reviews.length }} review{{ reviews.length !== 1 ? 's' : '' }}</div>
            <div class="rating-divider"></div>
            <div class="rating-meta">
              <div class="meta-row">
                <span class="meta-label">Credits</span>
                <span class="meta-value">{{ course.credits }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Workload</span>
                <span class="meta-value">{{ course.workloadHours || '—' }} hrs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <el-card class="ai-summary-card" shadow="never">
        <template #header>
          <div class="summary-header">
            <div class="summary-title">
              <span class="summary-icon">🤖</span>
              <span>AI Course Review Summary</span>
            </div>
            <el-button type="primary" :loading="isGenerating" :disabled="isGenerating" @click="fetchAiSummary">
              {{ summaryData ? 'Regenerate' : 'Generate Summary' }}
            </el-button>
          </div>
        </template>
        <div v-if="summaryData" class="summary-content">
          <p class="summary-text">{{ summaryData }}</p>
          <p class="ai-disclaimer">AI summaries may contain mistakes. Verify course rules and advice with official university sources.</p>
        </div>
        <el-empty v-else description="Generate an AI summary of approved student reviews." :image-size="80" />
      </el-card>

      <div class="detail-grid">
        <el-card shadow="never" class="info-card">
          <h2 class="card-heading">Course Information</h2>
          <dl class="info-list">
            <div class="info-item">
              <dt>Credits</dt>
              <dd>{{ course.credits }} points</dd>
            </div>
            <div class="info-item">
              <dt>Estimated study time</dt>
              <dd>{{ course.workloadHours ? `${course.workloadHours} hours per semester` : 'Not provided' }}</dd>
            </div>
            <div class="info-item">
              <dt>Course level</dt>
              <dd>{{ course.level ? `Level ${course.level}` : 'Not specified' }}</dd>
            </div>
            <div class="info-item">
              <dt>Offered in</dt>
              <dd>
                <template v-if="normalizeSemesters(course.offeredSemesters).length">
                  {{ normalizeSemesters(course.offeredSemesters).map(s => s.replaceAll('_', ' ')).join(', ') }}
                </template>
                <template v-else>Not specified</template>
              </dd>
            </div>
            <div class="info-item">
              <dt>Assessment types</dt>
              <dd>{{ course.assessmentTypes?.length ? course.assessmentTypes.map(type => type.toLowerCase()).join(', ') : 'Not specified' }}</dd>
            </div>
            <div class="info-item">
              <dt>Official information</dt>
              <dd><a v-if="safeOfficialLink" :href="safeOfficialLink" target="_blank" rel="noopener noreferrer">Open official course page</a><span v-else>Not provided</span></dd>
            </div>
          </dl>
        </el-card>

        <el-card shadow="never" class="info-card">
          <h2 class="card-heading">Prerequisites & Pathways</h2>
          <div class="pathway-section">
            <h3>Prerequisites</h3>
            <p v-if="!course.prerequisites?.length" class="muted-text">This course has no prerequisites.</p>
            <div v-else class="tag-list">
              <el-tag
                v-for="item in course.prerequisites"
                :key="item.id"
                class="clickable-tag"
                @click="openRelatedCourse(item.id)"
              >
                {{ item.code }} · {{ item.name }}
              </el-tag>
            </div>
          </div>
          <div class="pathway-section">
            <h3>Unlocks next</h3>
            <p v-if="!course.prerequisiteFor?.length" class="muted-text">No follow-on courses have been recorded.</p>
            <div v-else class="tag-list">
              <el-tag
                v-for="item in course.prerequisiteFor"
                :key="item.id"
                type="success"
                class="clickable-tag"
                @click="openRelatedCourse(item.id)"
              >
                {{ item.code }} · {{ item.name }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>

      <div class="review-layout">
        <div class="reviews-column">
          <h2 class="section-heading">Student Reviews</h2>
          <el-empty v-if="!reviews.length" description="There are no approved reviews yet" />
          <article v-for="review in reviews" :key="review.id" class="review-card">
            <div class="review-heading">
              <div class="review-author">
                <div class="author-avatar">{{ (review.user?.name || 'A').charAt(0).toUpperCase() }}</div>
                <div class="author-info">
                  <b>{{ review.user?.name || 'Anonymous student' }}</b>
                  <span class="muted-text">{{ review.user?.major || 'Student' }}</span>
                </div>
              </div>
              <div class="review-meta">
                <time :datetime="review.createdAt">{{ formatReviewDate(review.createdAt) }}</time>
                <el-button v-if="(!authStore.isLoggedIn || authStore.isStudent) && review.userId !== authStore.user?.id" link type="danger" size="small" @click="handleReport(review)">
                  Report
                </el-button>
              </div>
            </div>
            <el-rate :model-value="review.overallRating" disabled size="small" />
            <p class="review-comment">{{ review.comment || 'This student did not leave a written review.' }}</p>
          </article>
        </div>

        <el-card v-if="!authStore.isLoggedIn || authStore.isStudent" shadow="never" class="review-form-card">
          <div class="review-form-heading"><h2 class="card-heading">{{ ownReview ? 'Edit Your Review' : 'Write a Review' }}</h2><el-button link type="primary" @click="router.push({ name: 'ReviewSubmit', query: { courseId: course.id } })">Open full-page form</el-button></div>
          <p class="muted-text review-status">
            {{ ownReview ? `Current status: ${ownReview.status}. Saving sends it back for approval.` : 'Your review will be published after approval.' }}
          </p>
          <el-form label-position="top">
            <el-form-item label="Overall recommendation">
              <el-rate v-model="form.overallRating" />
            </el-form-item>
            <el-form-item label="Course difficulty">
              <el-rate v-model="form.difficultyRating" />
            </el-form-item>
            <el-form-item label="Study workload">
              <el-rate v-model="form.workloadRating" />
            </el-form-item>
            <el-form-item label="Teaching quality (optional)">
              <el-rate v-model="form.teachingRating" />
            </el-form-item>
            <el-form-item label="Usefulness (optional)">
              <el-rate v-model="form.usefulnessRating" />
            </el-form-item>
            <el-form-item label="Assessment style (optional)">
              <el-select v-model="form.assessmentStyle" clearable placeholder="Select assessment style" style="width:100%">
                <el-option label="Exam heavy" value="EXAM_HEAVY" />
                <el-option label="Coursework heavy" value="COURSEWORK_HEAVY" />
                <el-option label="Project based" value="PROJECT_BASED" />
                <el-option label="Practical" value="PRACTICAL" />
                <el-option label="Balanced" value="BALANCED" />
              </el-select>
            </el-form-item>
            <el-form-item label="Your review">
              <el-input
                v-model="form.comment"
                type="textarea"
                :rows="4"
                maxlength="2000"
                show-word-limit
                placeholder="Share your learning experience (optional)"
              />
            </el-form-item>
            <el-button type="primary" :loading="submitting" @click="handleReview" class="submit-review-btn">
              {{ ownReview ? 'Save review changes' : 'Submit review' }}
            </el-button>
          </el-form>
        </el-card>
      </div>
    </template>
  </section>
</template>

<style scoped>
.detail-page {
  max-width: 1080px;
  margin: 0 auto;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-size: 14px;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 16px;
  transition: all 0.2s ease;
}

.back-link:hover {
  color: var(--accent);
  background: var(--accent-bg);
}

.course-hero {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 32px;
  padding: 24px 0 32px;
  align-items: start;
}

.hero-info {
  min-width: 0;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.course-code {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-bg);
  padding: 4px 12px;
  border-radius: 8px;
}

.course-title {
  font-size: clamp(26px, 3.5vw, 40px);
  font-weight: 700;
  margin: 0 0 14px;
  color: var(--text-h);
  line-height: 1.25;
  word-wrap: break-word;
}

.course-desc {
  font-size: 16px;
  line-height: 1.7;
  color: var(--text);
  margin: 0 0 24px;
  max-width: 680px;
}

.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.save-action-btn {
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
  padding: 12px 24px !important;
  font-weight: 600 !important;
}

.save-action-btn:not(.el-button--warning) {
  background: var(--accent-gradient) !important;
  border: none !important;
}

.rating-sidebar {
  position: sticky;
  top: 80px;
}

.rating-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  text-align: center;
}

.rating-score {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
  margin-bottom: 8px;
}

.rating-number {
  font-size: 42px;
  font-weight: 800;
  color: var(--text-h);
  line-height: 1;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.rating-max {
  font-size: 16px;
  color: var(--text-muted);
  font-weight: 600;
}

.rating-count {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
}

.rating-divider {
  height: 1px;
  background: var(--border-light);
  margin: 16px 0;
}

.rating-meta {
  text-align: left;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.meta-label {
  font-size: 13px;
  color: var(--text-muted);
}

.meta-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
}

.ai-summary-card {
  margin-bottom: 24px;
  border-radius: var(--radius-lg) !important;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 16px;
  color: var(--text-h);
}

.summary-icon {
  font-size: 20px;
}

.summary-content {
  background: var(--accent-bg);
  border-radius: var(--radius);
  padding: 16px 20px;
  border-left: 3px solid var(--accent);
}

.summary-text {
  white-space: pre-wrap;
  line-height: 1.7;
  color: var(--text-h);
  font-size: 15px;
  margin: 0;
}

.review-form-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-disclaimer {
  margin: 12px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 32px;
}

.info-card {
  border-radius: var(--radius-lg) !important;
}

.card-heading {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: var(--text-h);
}

.info-list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
}

.info-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-item dt {
  font-size: 14px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.info-item dd {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-h);
  text-align: right;
  word-wrap: break-word;
  max-width: 60%;
}

.pathway-section {
  margin-bottom: 20px;
}

.pathway-section:last-child {
  margin-bottom: 0;
}

.pathway-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.muted-text {
  color: var(--text-muted);
  font-size: 14px;
  margin: 0;
  line-height: 1.6;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.clickable-tag {
  cursor: pointer;
  transition: all 0.2s ease;
}

.clickable-tag:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.review-layout {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 24px;
  align-items: start;
}

.section-heading {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 20px;
  color: var(--text-h);
}

.review-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 14px;
  border: 1px solid var(--border-light);
  transition: box-shadow 0.2s ease;
}

.review-card:hover {
  box-shadow: var(--shadow-sm);
}

.review-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.review-author {
  display: flex;
  align-items: center;
  gap: 10px;
}

.author-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent-gradient);
  color: white;
  display: grid;
  place-items: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.author-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.author-info b {
  font-size: 14px;
  color: var(--text-h);
}

.author-info span {
  font-size: 12px;
}

.review-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.review-meta time {
  font-size: 12px;
  color: var(--text-muted);
}

.review-comment {
  margin-top: 10px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text);
  word-wrap: break-word;
}

.review-form-card {
  position: sticky;
  top: 80px;
  border-radius: var(--radius-lg) !important;
}

.review-status {
  margin-bottom: 16px;
  font-size: 13px;
}

.submit-review-btn {
  width: 100%;
  padding: 12px !important;
}

@media (max-width: 860px) {
  .course-hero {
    grid-template-columns: 1fr;
  }

  .rating-sidebar {
    position: static;
  }

  .rating-card {
    display: flex;
    align-items: center;
    gap: 24px;
    text-align: left;
  }

  .rating-divider {
    width: 1px;
    height: 40px;
    margin: 0;
  }

  .rating-meta {
    flex: 1;
  }

  .detail-grid,
  .review-layout {
    grid-template-columns: 1fr;
  }

  .review-form-card {
    position: static;
  }
}

@media (max-width: 560px) {
  .rating-card {
    flex-direction: column;
    text-align: center;
  }

  .rating-divider {
    width: 100%;
    height: 1px;
  }

  .hero-actions {
    flex-direction: column;
  }

  .hero-actions .el-button {
    width: 100%;
    justify-content: center;
  }

  .info-item dd {
    max-width: 50%;
  }
}
</style>
