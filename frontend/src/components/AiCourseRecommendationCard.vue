<!-- @file Displays one recommended course together with its AI-generated explanation. -->
<script setup>
import { computed } from 'vue'

const props = defineProps({
  course: {
    type: Object,
    required: true,
  },
  reasons: {
    type: Array,
    default: () => [],
  },
  cautions: {
    type: Array,
    default: () => [],
  },
  completedCourseAnalysis: {
    type: Array,
    default: () => [],
  },
})

const displayedReasons = computed(() => props.reasons.length
  ? props.reasons
  : [`${props.course.name} matches your request based on the course information shown above.`])

const displayedCautions = computed(() => props.cautions.length
  ? props.cautions
  : ['Course-specific planning details are unavailable; check the official course information before enrolling.'])
</script>

<template>
  <el-card class="recommendation-card">
    <div class="course-header">
      <div>
        <span class="course-code">{{ course.code }}</span>
        <h3>{{ course.name }}</h3>
        <p>{{ course.description }}</p>
      </div>
      <el-tag v-if="course.similarity" class="match-tag">
        {{ (course.similarity * 100).toFixed(0) }}% match
      </el-tag>
    </div>

    <div class="recommendation-reason">
      <div v-if="completedCourseAnalysis.length" class="completed-foundation">
        <strong>Your completed-course foundation</strong>
        <ul>
          <li v-for="(item, index) in completedCourseAnalysis" :key="`${index}-${item}`">{{ item }}</li>
        </ul>
      </div>
      <div>
        <strong>Why this course fits your requirements</strong>
        <ul>
          <li v-for="(reason, index) in displayedReasons" :key="`${index}-${reason}`">{{ reason }}</li>
        </ul>
      </div>
      <div class="cautions">
        <strong>Points to consider</strong>
        <ul>
          <li v-for="(caution, index) in displayedCautions" :key="`${index}-${caution}`">{{ caution }}</li>
        </ul>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.recommendation-card{margin-top:12px}.course-header{display:flex;justify-content:space-between;gap:20px}.course-header h3{margin:8px 0;font-size:18px}.course-header p{font-size:14px;line-height:1.5}.course-code{color:var(--accent);font-weight:700}.match-tag{--el-tag-text-color:var(--accent);--el-tag-bg-color:var(--accent-bg);--el-tag-border-color:var(--accent-border)}.recommendation-reason{padding-top:16px;margin-top:16px;border-top:1px solid var(--border)}.recommendation-reason ul{margin:8px 0 0;padding-left:22px;line-height:1.7}.completed-foundation{margin-bottom:16px;padding:12px 14px;background:var(--accent-bg);border-radius:var(--radius-sm)}.completed-foundation strong{color:var(--text-h)}.cautions{margin-top:12px}@media(max-width:600px){.course-header{display:block}.course-header .el-tag{margin-top:10px}}
</style>
