<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getPendingReports, getPendingReviews, moderateReview, updateReportStatus } from '../api/reviews'
import { useModerationStore } from '../stores/moderation'

const moderationStore = useModerationStore()
const reviews = ref([])
const reports = ref([])
const loading = ref(false)
const activeDecision = ref(null)
const error = ref('')

const queueLabel = computed(() => `${reviews.value.length + reports.value.length} pending`)

const ratingFields = [
  ['Overall', 'overallRating'],
  ['Difficulty', 'difficultyRating'],
  ['Workload', 'workloadRating'],
  ['Teaching', 'teachingRating'],
  ['Usefulness', 'usefulnessRating'],
]

function formatDate(value) {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatAssessmentStyle(value) {
  return value ? value.toLowerCase().replaceAll('_', ' ') : 'Not specified'
}

async function loadQueues() {
  loading.value = true
  error.value = ''
  try {
    ;[reviews.value, reports.value] = await Promise.all([getPendingReviews(), getPendingReports()])
    moderationStore.setCounts(reviews.value.length, reports.value.length)
  } catch (err) {
    error.value = err.response?.data?.message || 'Unable to load the moderation queue.'
  } finally {
    loading.value = false
  }
}

async function decideReport(report, status, hideReview = false) {
  activeDecision.value = `report:${report.id}:${status}`
  try {
    if (hideReview) await moderateReview(report.reviewId, 'HIDDEN')
    await updateReportStatus(report.id, status)
    reports.value = reports.value.filter((item) => item.id !== report.id)
    moderationStore.setCounts(reviews.value.length, reports.value.length)
    ElMessage.success(hideReview ? 'Review hidden and report resolved.' : `Report ${status.toLowerCase()}.`)
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to process this report.')
  } finally {
    activeDecision.value = null
  }
}

async function decide(review, status) {
  if (status === 'REJECTED') {
    try {
      await ElMessageBox.confirm(
        `Reject the review for ${review.course.code}? It will not be published.`,
        'Reject review',
        { confirmButtonText: 'Reject', cancelButtonText: 'Cancel', type: 'warning' },
      )
    } catch {
      return
    }
  }

  activeDecision.value = `${review.id}:${status}`
  try {
    await moderateReview(review.id, status)
    reviews.value = reviews.value.filter((item) => item.id !== review.id)
    moderationStore.setCounts(reviews.value.length, reports.value.length)
    ElMessage.success(status === 'APPROVED' ? 'Review approved and published.' : 'Review rejected.')
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to update this review.')
  } finally {
    activeDecision.value = null
  }
}

onMounted(loadQueues)
</script>

<template>
  <section class="moderation-page">
    <header class="desk-header">
      <div>
        <p class="eyebrow">REVIEW DESK · QUALITY CONTROL</p>
        <h1>Publication queue</h1>
        <p class="lede">Check submissions before publication and investigate reports from students.</p>
      </div>
      <div class="queue-stamp" aria-live="polite">
        <span>QUEUE</span>
        <strong>{{ queueLabel }}</strong>
      </div>
    </header>

    <div class="toolbar">
      <p>Oldest submissions and reports are shown first.</p>
      <el-button :loading="loading" @click="loadQueues">Refresh queue</el-button>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      class="state-alert"
    />

    <div v-loading="loading" class="review-ledger">
      <article v-for="review in reviews" :key="review.id" class="review-sheet">
        <div class="sheet-rail">
          <span class="review-number">#{{ review.id }}</span>
          <span class="pending-mark">PENDING</span>
        </div>

        <div class="sheet-body">
          <div class="review-context">
            <div>
              <span class="course-code">{{ review.course.code }}</span>
              <h2>{{ review.course.name }}</h2>
            </div>
            <div class="submission-meta">
              <strong>{{ review.user.name }}</strong>
              <span>{{ review.user.major || 'Programme not provided' }}</span>
              <time :datetime="review.createdAt">{{ formatDate(review.createdAt) }}</time>
            </div>
          </div>

          <div class="rating-strip" aria-label="Submitted ratings">
            <div v-for="([label, field]) in ratingFields" :key="field" class="rating-cell">
              <span>{{ label }}</span>
              <strong>{{ review[field] ?? '—' }}<small v-if="review[field]">/5</small></strong>
            </div>
          </div>

          <div class="review-copy">
            <span>STUDENT COMMENT</span>
            <p>{{ review.comment || 'No written comment was submitted.' }}</p>
          </div>

          <div class="sheet-footer">
            <span class="assessment-chip">Assessment: {{ formatAssessmentStyle(review.assessmentStyle) }}</span>
            <div class="decision-actions">
              <el-button
                type="danger"
                plain
                :loading="activeDecision === `${review.id}:REJECTED`"
                :disabled="activeDecision !== null && activeDecision !== `${review.id}:REJECTED`"
                @click="decide(review, 'REJECTED')"
              >Reject</el-button>
              <el-button
                type="success"
                :loading="activeDecision === `${review.id}:APPROVED`"
                :disabled="activeDecision !== null && activeDecision !== `${review.id}:APPROVED`"
                @click="decide(review, 'APPROVED')"
              >Approve & publish</el-button>
            </div>
          </div>
        </div>
      </article>

      <div v-if="!loading && !error && reviews.length === 0" class="empty-queue">
        <span class="empty-check">✓</span>
        <h2>Queue cleared</h2>
        <p>There are no student reviews waiting for publication.</p>
      </div>
    </div>

    <div class="report-section">
      <div class="section-heading"><div><p class="eyebrow">COMMUNITY REPORTS</p><h2>Reported reviews</h2></div><el-tag type="warning">{{ reports.length }} pending</el-tag></div>
      <article v-for="report in reports" :key="report.id" class="report-card">
        <div>
          <span class="course-code">{{ report.review.course.code }}</span>
          <h3>{{ report.review.course.name }}</h3>
          <p class="reported-copy">{{ report.review.comment || 'This review has no written comment.' }}</p>
          <p class="report-reason"><strong>Report from {{ report.reporter.name }}:</strong> {{ report.reason }}</p>
        </div>
        <div class="decision-actions">
          <el-button :loading="activeDecision === `report:${report.id}:DISMISSED`" @click="decideReport(report, 'DISMISSED')">Dismiss</el-button>
          <el-button type="success" plain :loading="activeDecision === `report:${report.id}:RESOLVED`" @click="decideReport(report, 'RESOLVED')">Keep review</el-button>
          <el-button type="danger" :loading="activeDecision === `report:${report.id}:RESOLVED`" @click="decideReport(report, 'RESOLVED', true)">Hide review</el-button>
        </div>
      </article>
      <el-empty v-if="!loading && reports.length === 0" description="No pending review reports" :image-size="70" />
    </div>
  </section>
</template>

<style scoped>
.moderation-page {
  --moderation-ink: var(--text-h);
  --moderation-surface: rgba(255, 255, 255, .88);
  --moderation-soft: rgba(114, 81, 232, .075);
  --moderation-line: var(--border);
  --moderation-accent: var(--accent);
  max-width: 1040px;
  margin: 0 auto;
}

.desk-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  padding: 30px 32px;
  border: 1px solid var(--accent-border);
  border-radius: 20px;
  background: var(--moderation-surface);
  box-shadow: var(--shadow);
}

.eyebrow {
  color: var(--moderation-accent);
  font: 750 12px/1.4 var(--mono);
  letter-spacing: .12em;
}

.desk-header h1 {
  margin: 8px 0 10px;
  color: var(--moderation-ink);
  font-size: clamp(34px, 4.8vw, 50px);
  line-height: 1.08;
  letter-spacing: -.04em;
  overflow-wrap: anywhere;
}

.lede {
  max-width: 650px;
  font-size: 15px;
  line-height: 1.65;
}

.queue-stamp {
  flex: 0 0 auto;
  min-width: 140px;
  padding: 14px 18px;
  border: 1px solid var(--accent-border);
  border-radius: 14px;
  color: var(--moderation-accent);
  background: var(--accent-bg);
  text-align: center;
}

.queue-stamp span {
  display: block;
  font: 700 11px/1.3 var(--mono);
  letter-spacing: .16em;
}

.queue-stamp strong {
  display: block;
  margin-top: 5px;
  color: var(--moderation-ink);
  font-size: 18px;
  line-height: 1.35;
  white-space: nowrap;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 22px 0 12px;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1.5;
}

.state-alert { margin: 12px 0; }
.review-ledger { min-height: 190px; }

.review-sheet {
  display: grid;
  grid-template-columns: 94px minmax(0, 1fr);
  margin-bottom: 16px;
  overflow: hidden;
  border: 1px solid var(--moderation-line);
  border-radius: 18px;
  background: var(--moderation-surface);
  box-shadow: 0 10px 28px rgba(58, 40, 92, .06);
}

.sheet-rail {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 14px;
  padding: 22px 14px;
  border-right: 1px solid var(--moderation-line);
  background: var(--moderation-soft);
}

.review-number {
  color: var(--moderation-ink);
  font: 700 13px/1.4 var(--mono);
}

.pending-mark {
  align-self: flex-start;
  padding: 5px 7px;
  border: 1px solid var(--accent-border);
  border-radius: 6px;
  color: var(--moderation-accent);
  background: rgba(255, 255, 255, .58);
  font: 700 9px/1.3 var(--mono);
  letter-spacing: .08em;
}

.sheet-body {
  min-width: 0;
  padding: 24px 26px 20px;
}

.review-context {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
  gap: 24px;
  align-items: start;
}

.course-code {
  color: var(--moderation-accent);
  font: 800 13px/1.4 var(--mono);
  letter-spacing: .07em;
}

.review-context h2 {
  margin: 5px 0 0;
  color: var(--moderation-ink);
  font-size: clamp(20px, 2.5vw, 25px);
  line-height: 1.25;
  letter-spacing: -.02em;
  overflow-wrap: anywhere;
}

.submission-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  text-align: right;
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.submission-meta strong { color: var(--moderation-ink); }
.submission-meta time { color: var(--text); font-family: var(--mono); font-size: 12px; }

.rating-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
  gap: 8px;
  margin: 22px 0;
}

.rating-cell {
  min-width: 0;
  padding: 12px 13px;
  border: 1px solid rgba(114, 81, 232, .11);
  border-radius: 10px;
  background: var(--moderation-soft);
}

.rating-cell span {
  display: block;
  color: var(--text);
  font: 650 10px/1.4 var(--mono);
  letter-spacing: .035em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.rating-cell strong {
  display: block;
  margin-top: 4px;
  color: var(--moderation-ink);
  font-size: 20px;
  line-height: 1.25;
}

.rating-cell small {
  margin-left: 2px;
  color: var(--text);
  font-size: 11px;
  vertical-align: baseline;
}

.review-copy > span {
  color: var(--moderation-accent);
  font: 700 10px/1.4 var(--mono);
  letter-spacing: .12em;
}

.review-copy p {
  margin-top: 8px;
  color: var(--text-h);
  font-size: 15px;
  line-height: 1.72;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.sheet-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 22px;
}

.assessment-chip {
  max-width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--accent-border);
  border-radius: 8px;
  color: var(--moderation-accent);
  background: var(--accent-bg);
  font: 650 12px/1.4 var(--mono);
  text-transform: capitalize;
  overflow-wrap: anywhere;
}

.decision-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.report-section { margin-top: 34px; padding-top: 28px; border-top: 1px solid var(--moderation-line); }
.section-heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; }
.section-heading h2 { margin:5px 0 0; }
.report-card { display:grid; grid-template-columns:1fr auto; gap:24px; align-items:center; margin-bottom:12px; padding:20px 22px; border:1px solid var(--moderation-line); border-radius:16px; background:var(--moderation-surface); }
.report-card h3 { margin:4px 0 10px; color:var(--moderation-ink); }
.reported-copy { color:var(--text-h); line-height:1.6; }
.report-reason { margin-top:12px; padding:11px 13px; border-radius:10px; background:var(--moderation-soft); line-height:1.55; }

.empty-queue {
  padding: 62px 20px;
  border: 1px dashed var(--accent-border);
  border-radius: 18px;
  background: var(--moderation-surface);
  text-align: center;
}

.empty-check {
  display: inline-grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 2px solid #3e8b67;
  border-radius: 50%;
  color: #3e8b67;
  background: rgba(62, 139, 103, .08);
  font-size: 25px;
  line-height: 1;
}

.empty-queue h2 {
  margin: 14px 0 7px;
  color: var(--moderation-ink);
  line-height: 1.3;
}

.empty-queue p { line-height: 1.6; }

@media (max-width: 760px) {
  .desk-header {
    align-items: flex-start;
    flex-direction: column;
    padding: 24px;
  }

  .queue-stamp { align-self: flex-start; }
  .review-context { grid-template-columns: 1fr; gap: 14px; }
  .submission-meta { text-align: left; }
}

@media (max-width: 560px) {
  .toolbar { align-items: flex-start; flex-direction: column; gap: 10px; }
  .review-sheet { grid-template-columns: 1fr; }
  .sheet-rail {
    align-items: center;
    flex-direction: row;
    justify-content: space-between;
    padding: 11px 15px;
    border-right: 0;
    border-bottom: 1px solid var(--moderation-line);
  }
  .sheet-body { padding: 20px 16px; }
  .rating-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sheet-footer { align-items: stretch; flex-direction: column; }
  .decision-actions { width: 100%; }
  .decision-actions :deep(.el-button) { flex: 1; }
  .report-card { grid-template-columns:1fr; }
}

@media (max-width: 420px) {
  .desk-header { padding: 21px 18px; }
  .desk-header h1 { font-size: 32px; }
  .rating-strip { grid-template-columns: 1fr; }
  .decision-actions { flex-direction: column; }
  .decision-actions :deep(.el-button) { width: 100%; margin-left: 0; }
}
</style>
