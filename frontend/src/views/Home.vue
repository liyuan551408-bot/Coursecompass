<script setup>

import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { searchCourses } from '../api/courses'
import homepageImg from '../images/homepage.jpg'
import discoverImg from '../images/discover.jpg'
import compareImg from '../images/compare.jpg'
import planImg from '../images/plan.jpg'

const router = useRouter()
const authStore = useAuthStore()

const featuredCourses = ref([])
const coursesLoading = ref(true)

const heroImage = homepageImg
const stepImages = [discoverImg, compareImg, planImg]

const features = [
  {
    icon: '🔍',
    title: 'Smart Course Search',
    desc: 'Search by course code, name, or keyword with fuzzy matching. Filter by level, semester, credits, and assessment type to find exactly what fits.',
    color: '#7251e8',
  },
  {
    icon: '🤖',
    title: 'AI-Powered Recommendations',
    desc: 'Get personalized course suggestions powered by semantic search and AI. Tell us your interests and goals, and we will build your shortlist.',
    color: '#a855f7',
  },
  {
    icon: '⚖️',
    title: 'Side-by-Side Comparison',
    desc: 'Compare courses on workload, difficulty, ratings, and assessment styles. Make informed decisions with clear data, not guesswork.',
    color: '#3ecfb0',
  },
  {
    icon: '🔖',
    title: 'Save & Organize',
    desc: 'Quick-save courses you are interested in. Build your watchlist and revisit them anytime from your saved courses page.',
    color: '#f59e0b',
  },
  {
    icon: '📅',
    title: 'Semester Planner',
    desc: 'Drag and drop courses into your semester plan. Track total credits and workload hours to keep your study load balanced.',
    color: '#3b82f6',
  },
  {
    icon: '⭐',
    title: 'Student Reviews & AI Summaries',
    desc: 'Read real student reviews and generate AI summaries of course feedback. Know what to expect before you enrol.',
    color: '#ef4444',
  },
]

const steps = [
  {
    number: '01',
    title: 'Browse & Discover',
    desc: 'Explore the full course catalogue with powerful search and filters. Find courses that match your interests and academic goals.',
  },
  {
    number: '02',
    title: 'Save & Compare',
    desc: 'Bookmark courses with one click, then compare them side by side. Check ratings, workload, and prerequisites to narrow down your choices.',
  },
  {
    number: '03',
    title: 'Plan Your Semester',
    desc: 'Build your ideal timetable with the semester planner. Balance credits and workload, and get AI recommendations along the way.',
  },
]

function handleGetStarted() {
  if (authStore.isLoggedIn) {
    router.push('/dashboard')
  } else {
    router.push('/register')
  }
}

async function loadFeaturedCourses() {
  try {
    const results = await searchCourses({ keyword: '', mode: 'fuzzy' })
    featuredCourses.value = results.slice(0, 3)
  } catch {
    featuredCourses.value = []
  } finally {
    coursesLoading.value = false
  }
}

onMounted(loadFeaturedCourses)
</script>

<template>
  <div class="home-page">

    <section class="hero-section">
      <div class="hero-content">
        <div class="hero-badge">
          <span class="badge-dot"></span>
          Your all-in-one course planning companion
        </div>
        <h1 class="hero-title">
          Find courses that
          <span class="gradient-text">fit you best</span>
        </h1>
        <p class="hero-subtitle">
          CourseCompass helps you explore, compare, and plan your university courses with confidence.
          Use AI-powered recommendations, student reviews, and smart tools to make the right enrolment decisions.
        </p>
        <div class="hero-actions">
          <el-button type="primary" size="large" @click="handleGetStarted" class="hero-cta">
            {{ authStore.isLoggedIn ? 'Go to Dashboard' : 'Get Started Free' }}
            <span class="cta-arrow">→</span>
          </el-button>
          <el-button size="large" @click="$router.push('/courses')" class="hero-secondary">
            Browse Courses
          </el-button>
        </div>
      </div>
      <div class="hero-visual">
        <div class="hero-image-stack">
          <div class="hero-image-main">
            <img :src="heroImage" alt="CourseCompass" />
          </div>
        </div>
      </div>
    </section>

    <section class="features-section">
      <div class="section-header">
        <p class="section-eyebrow">FEATURES</p>
        <h2>Everything you need to plan smarter</h2>
        <p class="section-subtitle">Powerful tools designed to make course selection simple, data-driven, and stress-free.</p>
      </div>
      <div class="features-grid">
        <div
          v-for="(feature, index) in features"
          :key="feature.title"
          class="feature-card"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          <div class="feature-icon" :style="{ background: `${feature.color}15`, color: feature.color }">
            {{ feature.icon }}
          </div>
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.desc }}</p>
        </div>
      </div>
    </section>

    <section class="steps-section">
      <div class="section-header">
        <p class="section-eyebrow">HOW IT WORKS</p>
        <h2>Plan your semester in three steps</h2>
        <p class="section-subtitle">From discovery to enrolment, CourseCompass guides you at every stage.</p>
      </div>
      <div class="steps-grid">
        <div v-for="(step, index) in steps" :key="step.number" class="step-card">
          <div class="step-image-wrapper">
            <img :src="stepImages[index]" :alt="step.title" class="step-image" />

          </div>
          <div class="step-content">
            <h3>{{ step.title }}</h3>
            <p>{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section v-if="featuredCourses.length" class="featured-section">
      <div class="section-header">
        <p class="section-eyebrow">EXPLORE</p>
        <h2>Popular courses right now</h2>
        <p class="section-subtitle">A glimpse of what is trending in the course catalogue.</p>
      </div>
      <div class="featured-grid">
        <div
          v-for="course in featuredCourses"
          :key="course.id"
          class="featured-card"
          @click="router.push(`/courses/${course.id}`)"
        >
          <div class="featured-card-top">
            <span class="featured-code">{{ course.code }}</span>
            <span class="featured-credits">{{ course.credits }} credits</span>
          </div>
          <h3 class="featured-name text-clamp-2">{{ course.name }}</h3>
          <p class="featured-desc text-clamp-2">{{ course.description || 'No description available.' }}</p>
          <div class="featured-footer">
            <span v-if="course.level" class="featured-level">Level {{ course.level }}</span>
            <span class="featured-cta">View details →</span>
          </div>
        </div>
      </div>
      <div class="featured-more">
        <el-button size="large" @click="$router.push('/courses')">View All Courses</el-button>
      </div>
    </section>

    <section class="cta-section">
      <div class="cta-card">
        <div class="cta-content">
          <h2>Ready to build your perfect semester?</h2>
          <p>Join CourseCompass to make smarter course decisions. Free to start, no credit card required.</p>
          <div class="cta-actions">
            <el-button size="large" class="cta-btn" @click="handleGetStarted">
              {{ authStore.isLoggedIn ? 'Go to Dashboard' : 'Create Free Account' }}
            </el-button>
            <el-button size="large" plain class="cta-btn-outline" @click="$router.push('/courses')">
              Browse Catalogue
            </el-button>
          </div>
        </div>
        <div class="cta-decoration">
          <div class="cta-circle cta-circle--1"></div>
          <div class="cta-circle cta-circle--2"></div>
          <div class="cta-circle cta-circle--3"></div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  width: 100%;
  overflow: hidden;
}

.hero-section {
  display: flex;
  align-items: center;
  gap: 48px;
  padding: 56px 0 72px;
  min-height: 480px;
  position: relative;
}

.hero-content {
  flex: 1;
  min-width: 0;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--accent-bg);
  border: 1px solid var(--accent-border);
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 24px;
}

.badge-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-soft 2s ease-in-out infinite;
}

.hero-title {
  font-size: clamp(32px, 4.5vw, 56px);
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 20px;
  color: var(--text-h);
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 17px;
  line-height: 1.7;
  color: var(--text);
  margin-bottom: 32px;
  max-width: 520px;
}

.hero-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.hero-cta {
  padding: 14px 28px !important;
  font-size: 16px !important;
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
}

.cta-arrow {
  transition: transform 0.2s ease;
}

.hero-cta:hover .cta-arrow {
  transform: translateX(4px);
}

.hero-secondary {
  padding: 14px 24px !important;
  font-size: 16px !important;
}

.hero-visual {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 0;
}

.hero-image-stack {
  position: relative;
  width: 100%;
  max-width: 420px;
}

.hero-image-main {
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  aspect-ratio: 4 / 3;
}

.hero-image-main img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
}

.hero-image-main:hover img {
  transform: scale(1.04);
}

.section-header {
  text-align: center;
  margin-bottom: 48px;
}

.section-eyebrow {
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.section-header h2 {
  font-size: clamp(26px, 3.5vw, 40px);
  font-weight: 700;
  margin: 0 0 12px;
  color: var(--text-h);
}

.section-subtitle {
  font-size: 16px;
  color: var(--text);
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.6;
}

.features-section {
  padding: 72px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.feature-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 28px;
  border: 1px solid var(--border-light);
  transition: all 0.3s ease;
  animation: fadeInUp 0.6s ease both;
}

.feature-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-border);
}

.feature-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 26px;
  margin-bottom: 18px;
}

.feature-card h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--text-h);
}

.feature-card p {
  font-size: 14px;
  color: var(--text);
  line-height: 1.65;
  margin: 0;
}

.steps-section {
  padding: 72px 0;
}

.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.step-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border-light);
  transition: all 0.3s ease;
}

.step-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.step-image-wrapper {
  position: relative;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: var(--accent-bg);
}

.step-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.step-card:hover .step-image {
  transform: scale(1.06);
}

.step-content {
  padding: 24px;
}

.step-content h3 {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-h);
}

.step-content p {
  font-size: 14px;
  color: var(--text);
  line-height: 1.65;
  margin: 0;
}

.featured-section {
  padding: 72px 0;
}

.featured-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 36px;
}

.featured-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.3s ease;
}

.featured-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--accent-border);
}

.featured-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.featured-code {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-bg);
  padding: 4px 10px;
  border-radius: 6px;
}

.featured-credits {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.featured-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-h);
  margin: 0 0 8px;
  line-height: 1.4;
}

.featured-desc {
  font-size: 14px;
  color: var(--text);
  line-height: 1.6;
  margin: 0 0 16px;
  min-height: 44px;
}

.featured-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 14px;
  border-top: 1px solid var(--border-light);
}

.featured-level {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.featured-cta {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  transition: transform 0.2s ease;
}

.featured-card:hover .featured-cta {
  transform: translateX(4px);
}

.featured-more {
  text-align: center;
}

.cta-section {
  padding: 40px 0 80px;
}

.cta-card {
  position: relative;
  background: var(--accent-gradient);
  border-radius: var(--radius-xl);
  padding: 56px 48px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(114, 81, 232, 0.3);
}

.cta-content {
  position: relative;
  z-index: 2;
  text-align: center;
  max-width: 600px;
  margin: 0 auto;
}

.cta-content h2 {
  font-size: clamp(24px, 3vw, 34px);
  font-weight: 700;
  margin: 0 0 12px;
  color: white;
}

.cta-content p {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 32px;
  line-height: 1.6;
}

.cta-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.cta-btn {
  background: white !important;
  color: var(--accent) !important;
  border-color: white !important;
  font-weight: 700 !important;
  padding: 14px 28px !important;
}

.cta-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.cta-btn-outline {
  background: transparent !important;
  color: white !important;
  border-color: rgba(255, 255, 255, 0.5) !important;
  font-weight: 600 !important;
}

.cta-btn-outline:hover {
  background: rgba(255, 255, 255, 0.1) !important;
  border-color: white !important;
}

.cta-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cta-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
}

.cta-circle--1 {
  width: 200px;
  height: 200px;
  top: -60px;
  right: -40px;
}

.cta-circle--2 {
  width: 140px;
  height: 140px;
  bottom: -40px;
  left: 10%;
}

.cta-circle--3 {
  width: 80px;
  height: 80px;
  top: 40%;
  right: 15%;
  background: rgba(255, 255, 255, 0.05);
}

@media (max-width: 960px) {
  .hero-section {
    flex-direction: column;
    text-align: center;
    padding: 40px 0 56px;
    gap: 40px;
  }

  .hero-subtitle {
    margin: 0 auto 32px;
  }

  .hero-actions {
    justify-content: center;
  }

  .hero-visual {
    order: -1;
    max-width: 320px;
  }

  .features-grid,
  .steps-grid,
  .featured-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .features-grid,
  .steps-grid,
  .featured-grid {
    grid-template-columns: 1fr;
  }

  .cta-card {
    padding: 40px 24px;
  }
}
</style>
