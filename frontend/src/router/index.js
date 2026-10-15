import { createRouter, createWebHistory } from 'vue-router'
import { getStoredUser, getToken } from '../utils/auth'

const Home = () => import('../views/Home.vue')
const Login = () => import('../views/Login.vue')
const Register = () => import('../views/Register.vue')
const ForgotPassword = () => import('../views/ForgotPassword.vue')
const ResetPassword = () => import('../views/ResetPassword.vue')
const Dashboard = () => import('../views/Dashboard.vue')
const CourseList = () => import('../views/CourseList.vue')
const CourseDetail = () => import('../views/CourseDetail.vue')
const CompareCourses = () => import('../views/CompareCourses.vue')
const Planner = () => import('../views/Planner.vue')
const SavedCourses = () => import('../views/SavedCourses.vue')
const AdminDashboard = () => import('../views/AdminDashboard.vue')
const ModerationDashboard = () => import('../views/ModerationDashboard.vue')
const Profile = () => import('../views/Profile.vue')
const AiRecommendation = () => import('../views/AiRecommendation.vue')
const Notifications = () => import('../views/Notifications.vue')
const ReviewSubmit = () => import('../views/ReviewSubmit.vue')

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/login', name: 'Login', component: Login, meta: { guestOnly: true } },
  { path: '/register', name: 'Register', component: Register, meta: { guestOnly: true } },
  { path: '/forgot-password', name: 'ForgotPassword', component: ForgotPassword, meta: { guestOnly: true } },
  { path: '/reset-password', name: 'ResetPassword', component: ResetPassword, meta: { guestOnly: true } },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: Dashboard,
    meta: { requiresAuth: true, roles: ['student'] },
  },
  { path: '/courses', name: 'CourseList', component: CourseList },
  { path: '/courses/:id', name: 'CourseDetail', component: CourseDetail },
  { path: '/compare', name: 'CompareCourses', component: CompareCourses },
  { path: '/ai-recommend', name: 'AiRecommendation', component: AiRecommendation, meta: { requiresAuth: true, roles: ['student'] } },
  { path: '/planner', name: 'Planner', component: Planner, meta: { requiresAuth: true, roles: ['student'] } },
  { path: '/saved', name: 'SavedCourses', component: SavedCourses, meta: { requiresAuth: true, roles: ['student'] } },
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboard,
    meta: { requiresAuth: true, roles: ['admin'] },
  },
  {
    path: '/moderation',
    name: 'ModerationDashboard',
    component: ModerationDashboard,
    meta: { requiresAuth: true, roles: ['moderator', 'admin'] },
  },
  { path: '/profile', name: 'Profile', component: Profile, meta: { requiresAuth: true } },
  { path: '/notifications', name: 'Notifications', component: Notifications, meta: { requiresAuth: true } },
  { path: '/reviews/new', name: 'ReviewSubmit', component: ReviewSubmit, meta: { requiresAuth: true, roles: ['student'] } },
]

function roleHome(user) {
  const role = user?.role?.toLowerCase()
  if (role === 'admin') return { name: 'AdminDashboard' }
  if (role === 'moderator') return { name: 'ModerationDashboard' }
  if (role === 'student') return { name: 'Dashboard' }
  return { name: 'Home' }
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition || { top: 0 }
  },
})

// Route guards guide navigation; protected API endpoints enforce authorization on the server.
router.beforeEach((to) => {
  const token = getToken()
  const user = getStoredUser()

  if (to.meta.requiresAuth && !token) {
    return { name: 'Login', query: { redirect: to.fullPath } }
  }

  if (to.meta.roles && (!user || !to.meta.roles.includes(user.role?.toLowerCase()))) {
    return roleHome(user)
  }

  if (to.meta.guestOnly && token) {
    return roleHome(user)
  }

  return true
})

export default router
