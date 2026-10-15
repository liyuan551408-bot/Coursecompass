<script setup>

import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import { useSavedStore } from './stores/saved'
import { usePlannerStore } from './stores/planner'
import { useNotificationStore } from './stores/notifications'
import { useModerationStore } from './stores/moderation'

const router = useRouter()
const authStore = useAuthStore()
const savedStore = useSavedStore()
const plannerStore = usePlannerStore()
const notificationStore = useNotificationStore()
const moderationStore = useModerationStore()
const BADGE_REFRESH_INTERVAL_MS = 15000
let badgeRefreshTimer

function stopBadgeRefresh() {
  clearInterval(badgeRefreshTimer)
  badgeRefreshTimer = undefined
}

async function refreshBadges() {
  if (!authStore.isLoggedIn) return
  const refreshes = [notificationStore.refresh()]
  if (authStore.isModerator || authStore.isAdmin) {
    refreshes.push(moderationStore.refresh())
  } else {
    moderationStore.reset()
  }
  await Promise.allSettled(refreshes)
}

function startBadgeRefresh() {
  stopBadgeRefresh()
  refreshBadges()
  badgeRefreshTimer = window.setInterval(() => {
    if (!document.hidden) refreshBadges()
  }, BADGE_REFRESH_INTERVAL_MS)
}

function resetAccountState() {
  authStore.restoreSession()
  savedStore.reset()
  plannerStore.reset()
  notificationStore.reset()
  moderationStore.reset()
  stopBadgeRefresh()
}

function refreshWhenVisible() {
  if (!document.hidden) refreshBadges()
}

function handleLogout() {
  authStore.logout()
  savedStore.reset()
  plannerStore.reset()
  notificationStore.reset()
  moderationStore.reset()
  stopBadgeRefresh()
  router.push('/login')
}

watch(() => [authStore.isLoggedIn, authStore.user?.id, authStore.user?.role], ([isLoggedIn]) => {
  if (isLoggedIn && authStore.isStudent) {
    savedStore.loadSaved().catch(() => {})
  } else {
    savedStore.reset()
    plannerStore.reset()
  }
  if (isLoggedIn) {
    startBadgeRefresh()
  } else {
    notificationStore.reset()
    moderationStore.reset()
    stopBadgeRefresh()
  }
}, { immediate: true })

const removeRouteRefreshHook = router.afterEach(() => refreshBadges())

onMounted(() => {
  window.addEventListener('focus', refreshWhenVisible)
  document.addEventListener('visibilitychange', refreshWhenVisible)
  window.addEventListener('course-compass:unauthorized', resetAccountState)
})

onBeforeUnmount(() => {
  stopBadgeRefresh()
  removeRouteRefreshHook()
  window.removeEventListener('focus', refreshWhenVisible)
  document.removeEventListener('visibilitychange', refreshWhenVisible)
  window.removeEventListener('course-compass:unauthorized', resetAccountState)
})
</script>

<template>
  <div id="app-root">
    <header class="app-header">
      <router-link to="/" class="logo">
        <span class="logo-mark">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </svg>
        </span>
        <span class="logo-text">CourseCompass</span>
      </router-link>

      <nav class="nav-links">
        <router-link v-if="authStore.isStudent" to="/dashboard" class="nav-link">Dashboard</router-link>
        <router-link to="/courses" class="nav-link">Courses</router-link>
        <router-link v-if="authStore.isStudent" to="/saved" class="nav-link nav-link--badge">
          Saved
          <span v-if="authStore.isLoggedIn && savedStore.savedCount > 0" class="nav-badge">
            {{ savedStore.savedCount > 99 ? '99+' : savedStore.savedCount }}
          </span>
        </router-link>
        <router-link v-if="authStore.isStudent" to="/planner" class="nav-link">Planner</router-link>
        <router-link to="/compare" class="nav-link">Compare</router-link>
        <router-link v-if="authStore.isStudent" to="/ai-recommend" class="nav-link">AI Recommendations</router-link>
        <router-link v-if="authStore.isModerator || authStore.isAdmin" to="/moderation" class="nav-link nav-link--badge">
          Moderation
          <span v-if="moderationStore.pendingCount" class="nav-badge" aria-label="Pending moderation items">
            {{ moderationStore.pendingCount > 99 ? '99+' : moderationStore.pendingCount }}
          </span>
        </router-link>
        <router-link v-if="authStore.isAdmin" to="/admin" class="nav-link">Admin</router-link>
      </nav>

      <div class="auth-area">
        <template v-if="authStore.isLoggedIn">
        <router-link to="/profile" class="user-link">
            <span class="user-avatar">{{ authStore.userName?.charAt(0)?.toUpperCase() || 'U' }}</span>
            <span class="user-name">{{ authStore.userName }}</span>
          </router-link>
          <router-link to="/notifications" class="nav-link nav-link--badge" aria-label="Notifications">Notifications<span v-if="notificationStore.unreadCount" class="nav-badge">{{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}</span></router-link>
          <el-button size="small" @click="handleLogout" class="logout-btn">Log out</el-button>
        </template>
        <template v-else>
          <router-link to="/login" class="auth-link">Log in</router-link>
          <el-button type="primary" size="small" @click="router.push('/register')">Sign up</el-button>
        </template>
      </div>
    </header>

    <main class="app-main">
      <router-view v-slot="{ Component }">
        <transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style scoped>
#app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 12px 32px;
  border-bottom: 1px solid rgba(114, 81, 232, 0.08);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  position: sticky;
  top: 0;
  z-index: 100;
  transition: box-shadow 0.3s ease;
}

.app-header:hover {
  box-shadow: 0 2px 20px rgba(50, 37, 79, 0.06);
}

.logo {
  font-weight: 800;
  color: var(--text-h);
  text-decoration: none;
  font-size: 17px;
  letter-spacing: -0.5px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.logo:hover {
  transform: scale(1.02);
}

.logo-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: white;
  border-radius: 10px;
  background: var(--accent-gradient);
  box-shadow: 0 4px 12px rgba(114, 81, 232, 0.3);
}

.logo-text {
  background: linear-gradient(135deg, var(--text-h) 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-links {
  display: flex;
  gap: 4px;
  flex: 1;
  align-items: center;
  overflow-x: auto;
  scrollbar-width: none;
}

.nav-links::-webkit-scrollbar {
  display: none;
}

.nav-link {
  position: relative;
  color: var(--text);
  text-decoration: none;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.nav-link:hover {
  color: var(--accent);
  background: var(--accent-bg);
}

.nav-link.router-link-active {
  color: var(--accent);
  background: var(--accent-bg);
}

.nav-link.router-link-active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  border-radius: 2px;
  background: var(--accent);
}

.nav-link--badge {
  padding-right: 8px;
}

.nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: var(--accent);
  border-radius: 10px;
  margin-left: 2px;
  animation: badge-pop 0.3s ease;
}

@keyframes badge-pop {
  0% { transform: scale(0.5); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

.auth-area {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.auth-link {
  color: var(--text-h);
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 12px;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.auth-link:hover {
  color: var(--accent);
  background: var(--accent-bg);
}

.user-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: var(--text-h);
  padding: 4px 10px 4px 4px;
  border-radius: 20px;
  transition: background 0.2s ease;
}

.user-link:hover {
  background: var(--accent-bg);
}

.user-avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent-gradient);
  color: white;
  font-size: 13px;
  font-weight: 700;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  border-radius: 10px !important;
}

.app-main {
  flex: 1;
  padding: 32px 24px 56px;
  max-width: 1180px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 900px) {
  .app-header {
    padding: 10px 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .nav-links {
    order: 3;
    flex-basis: 100%;
    padding-bottom: 4px;
    gap: 2px;
  }

  .nav-link {
    padding: 6px 10px;
    font-size: 13px;
  }

  .user-name {
    display: none;
  }

  .app-main {
    padding: 20px 16px 40px;
  }
}

@media (max-width: 480px) {
  .logo-text {
    display: none;
  }

  .auth-area .el-button {
    padding: 8px 12px;
  }
}
</style>
