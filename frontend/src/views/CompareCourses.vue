<script setup>

import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAllCoursesForComparison, getCourse } from '../api/courses'
import { getSubjects } from '../api/subjects'
import { getCourseComparisonAnalysis } from '../api/ai'
import { getToken } from '../utils/auth'
import { useSavedStore } from '../stores/saved'
import { useAuthStore } from '../stores/auth'
import { useCompareStore, MAX_COMPARE } from '../stores/compare'
import { courseDetailLocation } from '../utils/courseNavigation'
import SubjectNav from '../components/SubjectNav.vue'
import StreamingText from '../components/StreamingText.vue'

const router = useRouter()
const route = useRoute()
const savedStore = useSavedStore()
const authStore = useAuthStore()
const compareStore = useCompareStore()

const {
  selectedIds: compareIds,
  selectedCourses: compareCourses,
  searchQuery,
  subjectId,
  generating: aiLoading,
  analysis: aiAnalysis,
  summaryStreaming,
  originCourseId,
  canAdd,
} = storeToRefs(compareStore)

const loading = ref(false)
const allCourses = ref([])
const subjects = ref([])
const savingIds = ref(new Set())

function getCourseSubjectId(course) {
  const id = Number(course?.subjectId ?? course?.subject?.id)
  return Number.isInteger(id) && id > 0 ? id : null
}

const filteredCourses = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  return allCourses.value.filter((course) => {
    if (Number(course.id) === Number(originCourseId.value)) return false

    if (
      subjectId.value &&
      getCourseSubjectId(course) !== Number(subjectId.value)
    ) {
      return false
    }

    if (!keyword) return true

    return [course.code, course.name, course.description].some((value) =>
      value?.toLowerCase().includes(keyword),
    )
  })
})

const originCourse = computed(() =>
  compareCourses.value.find(
    course => Number(course.id) === Number(originCourseId.value),
  ),
)

const groupedCourses = computed(() => {
  const groups = new Map()

  for (const course of filteredCourses.value) {
    const key = course.subject?.id || course.subjectId || 'uncategorized'

    if (!groups.has(key)) {
      groups.set(key, {
        id: key,
        label: course.subject
          ? `${course.subject.code} — ${course.subject.name}`
          : 'Other courses',
        courses: [],
      })
    }

    groups.get(key).courses.push(course)
  }

  return [...groups.values()]
})

async function loadCourses() {
  loading.value = true

  try {
    allCourses.value = await getAllCoursesForComparison()
  } catch (err) {
    ElMessage.error('Failed to load courses')
  } finally {
    loading.value = false
  }
}

async function addToCompare(courseId) {
  if (aiLoading.value) return

  if (!canAdd.value) {
    ElMessage.warning(
      `You can compare up to ${MAX_COMPARE} courses at a time`,
    )
    return
  }

  if (compareIds.value.includes(Number(courseId))) return

  await loadCompareCourse(courseId)
}

async function loadCompareCourse(courseId) {
  if (compareIds.value.includes(Number(courseId))) return

  try {
    const course = await getCourse(courseId)
    compareStore.addCourse(course)
  } catch (err) {
    ElMessage.error('Failed to load course details')
  }
}

async function removeFromCompare(courseId) {
  if (aiLoading.value) return

  const id = Number(courseId)

  if (id === originCourseId.value) return

  try {
    await ElMessageBox.confirm(
      'Remove this course from the comparison?',
      'Confirm removal',
      {
        confirmButtonText: 'Remove',
        cancelButtonText: 'Cancel',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  compareStore.removeCourse(id)
}

async function clearAll() {
  if (aiLoading.value) return

  try {
    await ElMessageBox.confirm(
      'Clear all comparison selections?',
      'Confirm removal',
      {
        confirmButtonText: 'Clear all',
        cancelButtonText: 'Cancel',
        type: 'warning',
      },
    )
  } catch {
    return
  }

  compareStore.clearSelection()
}

function isInCompare(courseId) {
  return compareIds.value.includes(Number(courseId))
}

function parseCompareIds(value) {
  const raw = Array.isArray(value) ? value[0] : value

  if (typeof raw !== 'string') return []

  return [
    ...new Set(
      raw
        .split(',')
        .map(Number)
        .filter(id => Number.isInteger(id) && id > 0),
    ),
  ].slice(0, MAX_COMPARE)
}

function viewCourseDetails(courseId) {
  if (aiLoading.value) return
  router.push(courseDetailLocation(courseId, route, 'compare'))
}

async function generateAiComparison() {
  if (aiLoading.value) return

  if (compareIds.value.length < 2) {
    ElMessage.warning('Select at least two courses for an AI comparison')
    return
  }

  if (!getToken()) {
    ElMessage.warning('Please log in before generating an AI comparison')

    router.push({
      name: 'Login',
      query: {
        redirect: router.currentRoute.value.fullPath,
      },
    })

    return
  }

  if (!compareStore.beginGeneration()) return

  try {
    const result = await getCourseComparisonAnalysis([
      ...compareIds.value,
    ])

    compareStore.finishGeneration(result)
  } catch (err) {
    compareStore.endGeneration()

    const apiError = err.response?.data?.error

    const message =
      (typeof apiError === 'object'
        ? apiError.message
        : apiError) ||
      err.response?.data?.message ||
      (err.response?.status === 404
        ? 'The AI comparison endpoint is not available on the current backend'
        : '') ||
      (err.response?.status === 429
        ? 'Too many AI requests. Please try again later'
        : '') ||
      (err.response?.status === 503
        ? 'The AI provider is busy. Please try again shortly.'
        : '') ||
      (err.response?.status === 504
        ? 'The AI provider timed out. Please try again.'
        : '') ||
      (err.code === 'ECONNABORTED' ||
      err.code === 'ETIMEDOUT'
        ? 'The AI comparison timed out. Please try again.'
        : '') ||
      'Unable to generate AI comparison'

    ElMessage.error(message)
  }
}

function courseCodes(courseIds) {
  return courseIds
    .map(
      id =>
        compareCourses.value.find(
          course => course.id === Number(id),
        )?.code,
    )
    .filter(Boolean)
    .join(' and ')
}

async function handleQuickSave(course, event) {
  if (event) event.stopPropagation()

  if (!authStore.isLoggedIn) {
    router.push({
      name: 'Login',
      query: {
        redirect: router.currentRoute.value.fullPath,
      },
    })

    return
  }

  const id = Number(course.id)

  if (savingIds.value.has(id)) return

  savingIds.value.add(id)

  try {
    const saved = await savedStore.toggleSave(id)

    ElMessage.success(
      saved
        ? `Saved "${course.code}"`
        : `Removed "${course.code}" from saved`,
    )
  } catch (err) {
    ElMessage.error(
      err.response?.data?.message ||
        'Unable to update saved courses',
    )
  } finally {
    savingIds.value.delete(id)
  }
}

onMounted(async () => {
  const requestedCourseId = Number(route.query.courseId)

  if (
    Number.isInteger(requestedCourseId) &&
    requestedCourseId > 0
  ) {
    if (originCourseId.value !== requestedCourseId) {
      compareStore.clearSelection({
        keepOrigin: false,
      })
    }

    compareStore.setOrigin(requestedCourseId)
  }

  const restoredIds = parseCompareIds(
    route.query.compareIds,
  )

  const initialIds = [
    ...new Set([
      ...(originCourseId.value
        ? [originCourseId.value]
        : []),
      ...restoredIds,
    ]),
  ].slice(0, MAX_COMPARE)

  await Promise.all([
    loadCourses(),

    getSubjects()
      .then(value => {
        subjects.value = value
      })
      .catch(() => {
        subjects.value = []
      }),
  ])

  for (const courseId of initialIds) {
    await addToCompare(courseId)
  }

  if (authStore.isStudent) {
    savedStore.loadSaved().catch(() => {})
  }
})

watch(searchQuery, value =>
  compareStore.setSearch(value),
)

watch(subjectId, value =>
  compareStore.setSubject(value),
)
</script>

<template>
  <section class="compare-page">
    <div class="page-header">
      <div>
        <p class="eyebrow">COURSE COMPARISON</p>

        <h1>
          {{
            originCourse
              ? `Compare ${originCourse.code} with other courses`
              : 'Compare courses side by side'
          }}
        </h1>

        <p v-if="originCourse">
          Choose up to {{ MAX_COMPARE - 1 }} other courses
          to compare with {{ originCourse.code }}.
        </p>

        <p v-else>
          Select up to {{ MAX_COMPARE }} courses to compare
          credits, workload, ratings and prerequisites.
        </p>
      </div>

      <el-button
        v-if="
          compareCourses.length >
          (originCourse ? 1 : 0)
        "
        plain
        :disabled="aiLoading"
        @click="clearAll"
      >
        {{
          originCourse
            ? 'Clear comparisons'
            : 'Clear all'
        }}
      </el-button>
    </div>

    <SubjectNav
      v-model="subjectId"
      :subjects="subjects"
      :disabled="aiLoading"
    />

    <el-card
      class="selector-card"
      shadow="never"
    >
      <div class="selector-header">
        <h2>
          {{
            originCourse
              ? `Choose courses to compare with ${originCourse.code}`
              : 'Select courses to compare'
          }}
        </h2>

        <span class="count-badge">
          {{ compareIds.length }} /
          {{ MAX_COMPARE }} selected
        </span>
      </div>

      <div class="selector-search">
        <el-input
          v-model="searchQuery"
          clearable
          :disabled="aiLoading"
          placeholder="Search by course code, name or keyword"
        >
          <template #prefix>
            ⌕
          </template>
        </el-input>
      </div>

      <p
        v-if="aiLoading"
        class="selection-lock-note"
      >
        Course selection is locked while the AI
        comparison is generated.
      </p>

      <div
        v-loading="loading"
        class="course-selector"
        :class="{
          'course-selector--locked': aiLoading,
        }"
      >
        <section
          v-for="group in groupedCourses"
          :key="group.id"
          class="course-group"
        >

          <h3
            v-if="!subjectId"
            class="course-group-title"
          >
            {{ group.label }}

            <span>
              {{ group.courses.length }}
            </span>
          </h3>

          <div
            v-for="course in group.courses"
            :key="course.id"
            class="course-item"
            :class="{
              selected: isInCompare(course.id),
              disabled:
                aiLoading ||
                (!canAdd &&
                  !isInCompare(course.id)),
            }"
            @click="
              !aiLoading &&
              !isInCompare(course.id) &&
              canAdd &&
              addToCompare(course.id)
            "
          >
            <div class="course-info">
              <span class="course-code">
                {{ course.code }}
              </span>

              <span class="course-name">
                {{ course.name }}
              </span>
            </div>

            <div class="item-actions">
              <button
                v-if="
                  !authStore.isLoggedIn ||
                  authStore.isStudent
                "
                class="quick-save-btn"
                :disabled="aiLoading"
                :class="{
                  'quick-save-btn--saved':
                    savedStore.isSaved(course.id),
                }"
                :title="
                  savedStore.isSaved(course.id)
                    ? 'Remove from saved'
                    : 'Quick save'
                "
                @click="
                  handleQuickSave(
                    course,
                    $event,
                  )
                "
              >
                <svg
                  v-if="
                    !savedStore.isSaved(
                      course.id,
                    )
                  "
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                  />
                </svg>

                <svg
                  v-else
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                  />
                </svg>
              </button>

              <el-checkbox
                :model-value="
                  isInCompare(course.id)
                "
                :disabled="
                  aiLoading ||
                  (!canAdd &&
                    !isInCompare(course.id))
                "
                @change="
                  isInCompare(course.id)
                    ? removeFromCompare(
                        course.id,
                      )
                    : addToCompare(course.id)
                "
                @click.stop
              />
            </div>
          </div>
        </section>

        <el-empty
          v-if="
            !loading &&
            !filteredCourses.length
          "
          description="No matching courses"
        />
      </div>
    </el-card>

    <div
      v-if="compareCourses.length"
      class="compare-result"
    >
      <div class="result-heading">
        <h2>Comparison result</h2>

        <el-button
          type="primary"
          :loading="aiLoading"
          :disabled="
            aiLoading ||
            compareCourses.length < 2
          "
          @click="generateAiComparison"
        >
          ✨ Generate AI summary
        </el-button>
      </div>

      <div class="selected-overview">
        <div
          v-for="course in compareCourses"
          :key="course.id"
          class="overview-card"
        >
          <div class="overview-header">
            <span class="course-code">
              {{ course.code }}
            </span>

            <button
              v-if="
                !authStore.isLoggedIn ||
                authStore.isStudent
              "
              class="quick-save-btn"
              :class="{
                'quick-save-btn--saved':
                  savedStore.isSaved(course.id),
              }"
              :title="
                savedStore.isSaved(course.id)
                  ? 'Remove from saved'
                  : 'Quick save'
              "
              @click="
                handleQuickSave(course)
              "
            >
              <svg
                v-if="
                  !savedStore.isSaved(
                    course.id,
                  )
                "
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                />
              </svg>

              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                />
              </svg>
            </button>
          </div>

          <h3
            class="overview-name text-clamp-2"
          >
            {{ course.name }}
          </h3>

          <div class="overview-meta">
            <span>
              {{ course.credits }} credits
            </span>

            <span>
              {{
                course.workloadHours ||
                '—'
              }}h
            </span>

            <span v-if="course.level">
              Level {{ course.level }}
            </span>
          </div>

          <el-button
            link
            type="primary"
            size="small"
            :disabled="aiLoading"
            @click="
              viewCourseDetails(course.id)
            "
          >
            View details →
          </el-button>
        </div>
      </div>

      <el-card
        v-if="aiAnalysis"
        class="ai-summary-card"
        shadow="never"
      >
        <div class="ai-summary-header">
          <div>
            <p class="eyebrow">
              AI COURSE ANALYSIS
            </p>

            <h3>
              How these courses fit together
            </h3>
          </div>

          <el-tag type="info">
            Based on selected course data
          </el-tag>
        </div>

        <StreamingText
          v-if="aiAnalysis.summary"
          :text="aiAnalysis.summary"
          :animate="summaryStreaming"
          class="ai-summary-text"
          @complete="compareStore.completeSummaryStream()"
        />

        <div
          v-if="
            aiAnalysis.relationships?.length
          "
          class="ai-section"
        >
          <h4>Course relationships</h4>

          <div
            v-for="(
              relationship,
              index
            ) in aiAnalysis.relationships"
            :key="
              `${relationship.type}-${index}`
            "
            class="relationship-item"
          >
            <div
              class="relationship-title"
            >
              <el-tag
                size="small"
                type="success"
              >
                {{ relationship.type }}
              </el-tag>

              <strong>
                {{
                  courseCodes(
                    relationship.courseIds,
                  )
                }}
              </strong>
            </div>

            <p>
              {{ relationship.description }}
            </p>
          </div>
        </div>

        <div
          v-if="
            aiAnalysis.learningOrder?.length
          "
          class="ai-section"
        >
          <h4>
            Suggested learning order
          </h4>

          <div class="plain-text-lines">
            <p
              v-for="(
                item,
                index
              ) in aiAnalysis.learningOrder"
              :key="
                `${item.courseId}-${
                  item.position ||
                  index
                }`
              "
            >
              <strong>
                {{ index + 1 }}.
                {{
                  courseCodes([
                    item.courseId,
                  ])
                }}
              </strong>

              —
              {{ item.reason }}
            </p>
          </div>
        </div>

        <div
          v-if="
            aiAnalysis.strengths?.length ||
            aiAnalysis.tradeoffs?.length
          "
          class="ai-columns ai-section"
        >
          <div
            v-if="
              aiAnalysis.strengths?.length
            "
          >
            <h4>Strengths</h4>

            <div class="plain-text-lines">
              <p
                v-for="item in aiAnalysis.strengths"
                :key="item"
              >
                {{ item }}
              </p>
            </div>
          </div>

          <div
            v-if="
              aiAnalysis.tradeoffs?.length
            "
          >
            <h4>Trade-offs</h4>

            <div class="plain-text-lines">
              <p
                v-for="item in aiAnalysis.tradeoffs"
                :key="item"
              >
                {{ item }}
              </p>
            </div>
          </div>
        </div>

        <div
          v-if="
            aiAnalysis.recommendation
          "
          class="ai-recommendation"
        >
          <strong>
            Overall recommendation
          </strong>

          <p>
            {{
              aiAnalysis.recommendation
            }}
          </p>
        </div>

        <p
          v-if="aiAnalysis.limitations"
          class="ai-limitations"
        >
          {{ aiAnalysis.limitations }}
        </p>
      </el-card>
    </div>

    <el-empty
      v-else
      description="Select courses above to start comparing"
      class="empty-state"
    >
      <el-button
        type="primary"
        @click="
          router.push('/courses')
        "
      >
        Browse courses
      </el-button>
    </el-empty>
  </section>
</template>

<style scoped>
.compare-page {
  max-width: 1100px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  margin-bottom: 24px;
}

.eyebrow {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  margin: 0;
}

.page-header h1 {
  margin: 8px 0;
  font-size: 36px;
}

.page-header p {
  color: var(--text);
  margin: 0;
}

.selector-card {
  margin-bottom: 32px;
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.selector-header h2 {
  margin: 0;
  font-size: 20px;
}

.count-badge {
  background: var(--accent-bg);
  color: var(--accent);
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.selector-search {
  margin-bottom: 16px;
}

.selection-lock-note {
  margin: -4px 0 12px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

.course-selector {
  max-height: 280px;
  overflow-y: auto;

  border: 1px solid var(--border);
  border-radius: 8px;
}

.course-selector--locked {
  cursor: wait;
}

.course-group + .course-group {
  border-top:
    1px solid var(--border);
}

.course-group-title {
  position: sticky;
  top: 0;
  z-index: 1;

  display: flex;
  justify-content: space-between;

  margin: 0;
  padding: 9px 16px;

  color: var(--text-h);
  background: var(--bg);

  border-bottom:
    1px solid var(--border-light);

  font-size: 12px;
  letter-spacing: 0.03em;
}

.course-group-title span {
  color: var(--text-muted);
  font-weight: 500;
}

.course-item {
  display: flex;
  justify-content: space-between;
  align-items: center;

  padding: 12px 16px;

  border-bottom:
    1px solid var(--border);

  cursor: pointer;

  transition:
    background 0.15s;
}

.course-item:last-child {
  border-bottom: none;
}

.course-item:hover {
  background: var(--accent-bg);
}

.course-item.selected {
  background: var(--accent-bg);
}

.course-item.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.course-info {
  display: flex;
  align-items: center;
  gap: 12px;

  min-width: 0;
}

.course-code {
  color: var(--accent);
  font-weight: 700;
  font-size: 14px;
  flex-shrink: 0;
}

.course-name {
  color: var(--text-h);
  font-size: 15px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.quick-save-btn {
  width: 30px;
  height: 30px;

  border-radius: 8px;
  border: 1px solid var(--border);

  background:
    rgba(255, 255, 255, 0.9);

  color: var(--text-muted);

  cursor: pointer;

  display: grid;
  place-items: center;

  transition: all 0.2s ease;

  padding: 0;

  flex-shrink: 0;
}

.quick-save-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  transform: scale(1.1);
}

.quick-save-btn--saved {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}

.quick-save-btn--saved:hover {
  color: var(--danger);
  border-color: var(--danger);
  background:
    rgba(239, 68, 68, 0.1);
}

.quick-save-btn:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.selected-overview {
  display: grid;

  grid-template-columns:
    repeat(
      auto-fit,
      minmax(220px, 1fr)
    );

  gap: 14px;

  margin-bottom: 20px;
}

.overview-card {
  background: var(--bg-card);

  border:
    1px solid var(--border-light);

  border-radius: var(--radius);

  padding: 16px;

  transition: all 0.25s ease;
}

.overview-card:hover {
  box-shadow: var(--shadow);
  border-color:
    var(--accent-border);

  transform: translateY(-2px);
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: 10px;
}

.overview-name {
  font-size: 15px;
  font-weight: 600;

  color: var(--text-h);

  margin: 0 0 10px;

  line-height: 1.4;

  min-height: 42px;
}

.overview-meta {
  display: flex;
  flex-wrap: wrap;

  gap: 10px;

  font-size: 12px;
  color: var(--text-muted);

  margin-bottom: 10px;
}

.compare-result h2 {
  margin: 0 0 16px;
  font-size: 24px;
}

.result-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;

  gap: 16px;

  margin-bottom: 16px;
}

.result-heading h2 {
  margin-bottom: 0;
}

.ai-summary-card {
  margin-bottom: 20px;

  border:
    1px solid var(--accent);

  background: var(--accent-bg);
}

.ai-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;

  gap: 16px;
}

.ai-summary-header h3 {
  margin: 6px 0 0;
  font-size: 21px;
}

.ai-summary-text,
.relationship-item p,
.ai-recommendation p {
  line-height: 1.6;
}

.ai-summary-text {
  margin: 20px 0 0;

  color: var(--text-h);

  font-size: 16px;
}

.ai-section {
  margin-top: 20px;
}

.ai-section h4 {
  margin: 0 0 10px;
  color: var(--text-h);
}

.relationship-item {
  padding: 10px 0;

  border-top:
    1px solid var(--border);
}

.relationship-title {
  display: flex;
  align-items: center;

  gap: 8px;
}

.relationship-item p {
  margin: 6px 0 0;
}

.plain-text-lines {
  margin: 0;
  line-height: 1.7;
}

.plain-text-lines p {
  margin: 0 0 8px;
}

.ai-columns {
  display: grid;

  grid-template-columns:
    repeat(
      2,
      minmax(0, 1fr)
    );

  gap: 24px;
}

.ai-recommendation {
  margin-top: 20px;

  padding: 14px 16px;

  border-radius: 8px;

  background:
    rgba(255, 255, 255, 0.7);
}

.ai-recommendation p {
  margin: 6px 0 0;
}

.ai-limitations {
  margin: 16px 0 0;

  color: var(--text);

  font-size: 13px;
}

.empty-state {
  padding: 60px 0;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-header h1 {
    font-size: 28px;
  }

  .result-heading,
  .ai-summary-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .ai-columns {
    grid-template-columns: 1fr;
  }

  .selector-header {
    align-items: flex-start;
    gap: 12px;
  }

  .course-item {
    gap: 12px;
  }

  .course-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
