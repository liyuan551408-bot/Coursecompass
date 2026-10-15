<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getCourseRecommendations } from '../api/ai'
import AiCourseRecommendationCard from '../components/AiCourseRecommendationCard.vue'

const query = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref('')
const prompts = [
  'I want to study machine learning and have average maths confidence',
  'I need a manageable course for a software development pathway',
  'Help me plan a data science pathway from an introductory programming course',
]

const courses = computed(() => result.value?.candidateCourses || result.value?.courses || [])

function parseStructuredRationale(value) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string') return null

  const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const candidates = [cleaned]
  const objectStart = cleaned.indexOf('{')
  const objectEnd = cleaned.lastIndexOf('}')
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(cleaned.slice(objectStart, objectEnd + 1))
  }

  for (const candidate of candidates) {
    try {
      let parsed = JSON.parse(candidate)
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {

    }
  }
  return null
}

const rationalePayload = computed(() => {
  const current = result.value || {}
  const rawValues = [current.aiRationale, current.rationale, current.summary]
  const parsed = rawValues.map(parseStructuredRationale).find(Boolean)
  const recommendations = Array.isArray(current.recommendations) && current.recommendations.length
    ? current.recommendations
    : (Array.isArray(parsed?.recommendations) ? parsed.recommendations : [])
  const plainSummary = rawValues.find(value => (
    typeof value === 'string'
    && value.trim()
    && !parseStructuredRationale(value)
    && !value.trim().startsWith('{')
  ))
  const parsedSummary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : ''

  return {
    summary: parsedSummary || plainSummary || 'The AI has selected relevant courses for you.',
    recommendations,
  }
})

const courseRecommendations = computed(() => courses.value.map(course => {
  const recommendation = rationalePayload.value.recommendations
    .find(item => Number(item.courseId) === Number(course.id))
  return {
    course,
    reasons: Array.isArray(recommendation?.reasons) ? recommendation.reasons.filter(Boolean) : [],
    cautions: Array.isArray(recommendation?.cautions) ? recommendation.cautions.filter(Boolean) : [],
    completedCourseAnalysis: Array.isArray(recommendation?.completedCourseAnalysis)
      ? recommendation.completedCourseAnalysis.filter(Boolean)
      : [],
  }
}))

async function recommend() {
  if (loading.value) return
  if (!query.value.trim()) return
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await getCourseRecommendations(query.value)
  } catch (err) {
    error.value = err.response?.data?.error
      || err.response?.data?.message
      || (err.code === 'ECONNABORTED'
        ? 'The AI request took longer than expected. Please try again in a moment.'
        : null)
      || (!err.response
        ? 'CourseCompass could not reach the backend service. Check that the backend is running on the configured API URL.'
        : null)
      || (err.response?.status === 402
        ? 'SiliconFlow embedding is unavailable because the account balance or trial quota is insufficient.'
        : 'The AI recommendation service is temporarily unavailable. Please try again.')
    ElMessage.warning(error.value)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section class="ai-page">
    <el-alert
      title="Planning support only"
      description="Your request and non-identifying study preferences are processed by external AI providers. AI suggestions may be wrong and do not replace official academic advice; verify prerequisites and programme rules with the university."
      type="info"
      show-icon
      :closable="false"
      class="ai-notice"
    />
    <div class="ai-hero">
      <p class="eyebrow">AI COURSE COMPASS</p>
      <h1>Turn your goals into a course pathway</h1>
      <p>Tell the AI about your interests, background and time preferences for evidence-based course suggestions.</p>
      <el-input v-model="query" type="textarea" :rows="3" maxlength="500" show-word-limit :disabled="loading" placeholder="For example: I want to begin studying AI next semester, with programming practice and a manageable workload." @keyup.ctrl.enter="recommend" />
      <div class="ai-actions">
        <el-button type="primary" :loading="loading" :disabled="loading || !query.trim()" @click="recommend">✨ Generate recommendations</el-button>
        <span>Press Ctrl + Enter to submit</span>
      </div>
      <div class="prompt-list">
        <el-button v-for="prompt in prompts" :key="prompt" round size="small" :disabled="loading" @click="query = prompt">{{ prompt }}</el-button>
      </div>
    </div>
    <el-alert v-if="error" :title="error" type="warning" show-icon :closable="false" />
    <div v-if="result" class="ai-result">
      <el-alert v-if="result.warning" :title="result.warning" type="info" show-icon :closable="false" class="fallback-alert" />
      <div class="recommendations">
        <h2>Recommended courses</h2>
        <p class="rationale">{{ rationalePayload.summary }}</p>
        <p v-if="result.relevantCompletedCourses?.length" class="completed-context">
          <strong>Personalised with your completed study:</strong>
          {{ result.relevantCompletedCourses.map(course => `${course.code} ${course.name}`).join(', ') }}
        </p>
        <AiCourseRecommendationCard
          v-for="item in courseRecommendations"
          :key="item.course.id"
          :course="item.course"
          :reasons="item.reasons"
          :cautions="item.cautions"
          :completed-course-analysis="item.completedCourseAnalysis"
        />
        <el-empty v-if="!courses.length" description="The AI did not return any courses" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.ai-page{max-width:850px;margin:0 auto}.ai-notice{margin-bottom:16px}.ai-hero{padding:36px;border:1px solid var(--accent-border);border-radius:16px;background:linear-gradient(135deg,var(--accent-bg),transparent)}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.12em}.ai-hero h1{font-size:38px;margin:8px 0}.ai-hero>p:not(.eyebrow){line-height:1.6;margin-bottom:22px}.ai-actions{display:flex;align-items:center;gap:12px;margin-top:12px}.ai-actions span{font-size:13px;color:var(--text)}.prompt-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}.ai-result{margin-top:24px}.fallback-alert{margin-bottom:12px}.rationale{white-space:pre-wrap;line-height:1.7}.recommendations{margin-top:24px}.completed-context{margin-top:14px;padding:12px 14px;border-left:3px solid var(--secondary);background:var(--secondary-bg);border-radius:0 var(--radius-sm) var(--radius-sm) 0;font-size:14px;line-height:1.6}.completed-context strong{color:var(--text-h)}
</style>
