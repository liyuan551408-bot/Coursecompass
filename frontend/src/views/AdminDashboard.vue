<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createCourse, getAdminCourses, updateCourse } from '../api/courses'
import {
  getAdminStats,
  getAdminUsers,
  createStaffUser,
  changeUserRole,
} from '../api/admin'
import { PASSWORD_POLICY, PASSWORD_POLICY_MESSAGE } from '../utils/passwordPolicy'
import {
  getSubjects,
  createSubject,
  updateSubject,
} from '../api/subjects'

const courses = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref(null)
const query = ref('')
const prerequisiteIdsInput = ref('')
const stats = ref(null)
const users = ref([])
const userTotal = ref(0)
const userPage = ref(1)
const selectedUserRole = ref('')
const userRoleCounts = ref({ STUDENT: 0, MODERATOR: 0, ADMIN: 0 })
const usersLoading = ref(false)
const changingRoleId = ref(null)
const createStaffDialogVisible = ref(false)
const creatingStaff = ref(false)
const staffFormRef = ref(null)
const staffForm = reactive({ name: '', email: '', password: '', confirmPassword: '', role: 'MODERATOR' })
const staffRoleOptions = [
  { value: 'MODERATOR', label: 'Moderator' },
  { value: 'ADMIN', label: 'Administrator' },
]
const staffRules = {
  name: [{ required: true, message: 'Enter a name', trigger: 'blur' }],
  email: [
    { required: true, message: 'Enter an email address', trigger: 'blur' },
    { type: 'email', message: 'Enter a valid email address', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Enter a temporary password', trigger: 'blur' },
    { pattern: PASSWORD_POLICY, message: PASSWORD_POLICY_MESSAGE, trigger: 'blur' },
  ],
  confirmPassword: [{
    validator: (_rule, value, callback) => value === staffForm.password
      ? callback()
      : callback(new Error('Passwords do not match')),
    trigger: 'blur',
  }],
  role: [{ required: true, message: 'Select an account role', trigger: 'change' }],
}
const subjects = ref([])
const selectedSubjectId = ref(null)
const subjectDialogVisible = ref(false)
const subjectCode = ref('')
const subjectName = ref('')
const editingSubjectId = ref(null)
const subjectSaving = ref(false)
const userRoleOptions = [
  { value: '', label: 'All users' },
  { value: 'STUDENT', label: 'Students' },
  { value: 'MODERATOR', label: 'Moderators' },
  { value: 'ADMIN', label: 'Admins' },
]
const emptyForm = () => ({ name: '', code: '', credits: 15, description: '', workloadHours: 120, level: null, offeredSemesters: [], assessmentTypes: [], officialLink: '', subjectId: null, isActive: true })
const courseForm = reactive(emptyForm())
const selectedSubject = computed(() => subjects.value.find((subject) => Number(subject.id) === selectedSubjectId.value) || null)
const filteredCourses = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return courses.value.filter((course) => {
    const matchesSubject = selectedSubjectId.value === null
      || Number(course.subjectId ?? course.subject?.id) === selectedSubjectId.value
    const matchesKeyword = !keyword || `${course.code} ${course.name}`.toLowerCase().includes(keyword)
    return matchesSubject && matchesKeyword
  })
})
const parsePrerequisiteIds = (input) => input.split(',').map((value) => value.trim()).filter(Boolean)

async function loadCourses() {
  loading.value = true
  try { courses.value = await getAdminCourses() }
  catch (err) { ElMessage.error(err.response?.data?.message || 'Unable to load courses.') }
  finally { loading.value = false }
}
function openCreate() { editingId.value = null; Object.assign(courseForm, emptyForm()); prerequisiteIdsInput.value = ''; dialogVisible.value = true }
function openEdit(course) {
  editingId.value = course.id
  Object.assign(courseForm, { name: course.name, code: course.code, credits: course.credits, description: course.description || '', workloadHours: course.workloadHours, level: course.level, offeredSemesters: [...(course.offeredSemesters || [])], assessmentTypes: [...(course.assessmentTypes || [])], officialLink: course.officialLink || '', subjectId: course.subjectId ?? null, isActive: course.isActive })
  prerequisiteIdsInput.value = (course.prerequisites || []).map((item) => item.code).join(', ')
  dialogVisible.value = true
}
async function save() {
  if (!courseForm.name.trim() || !courseForm.code.trim()) return ElMessage.warning('Enter a course name and code.')
  saving.value = true
  try {
    const payload = { ...courseForm, code: courseForm.code.trim().toUpperCase(), prerequisiteIds: parsePrerequisiteIds(prerequisiteIdsInput.value) }
    if (editingId.value) await updateCourse(editingId.value, payload)
    else await createCourse(payload)
    ElMessage.success(editingId.value ? 'Course updated.' : 'Course created.')
    dialogVisible.value = false
    await loadCourses()
  } catch (err) { ElMessage.error(err.response?.data?.message || 'Unable to save course.') }
  finally { saving.value = false }
}
async function loadStats() {
  try {
    stats.value = await getAdminStats()
  } catch (err) {
    ElMessage.error(
      err.response?.data?.message ||
      'Unable to load admin statistics.',
    )
  }
}

async function loadUsers() {
  usersLoading.value = true

  try {
    const result = await getAdminUsers(userPage.value, 20, selectedUserRole.value)
    users.value = result.items
    userTotal.value = result.total
    userRoleCounts.value = result.roleCounts
  } catch (err) {
    ElMessage.error(
      err.response?.data?.message ||
      'Unable to load users.',
    )
  } finally {
    usersLoading.value = false
  }
}

async function handleRoleChange(user, newRole) {
  if (newRole === user.role) return

  changingRoleId.value = user.id

  try {
    await changeUserRole(user.id, newRole)
    ElMessage.success('User role updated.')
    await loadUsers()
  } catch (err) {
    ElMessage.error(
      err.response?.data?.message ||
      'Unable to update user role.',
    )
  } finally {
    changingRoleId.value = null
  }
}

function changeUserPage(page) {
  userPage.value = page
  loadUsers()
}

function selectUserRole(role) {
  selectedUserRole.value = role
  userPage.value = 1
  loadUsers()
}

function getUserRoleCount(role) {
  if (role) return userRoleCounts.value[role] || 0
  return Object.values(userRoleCounts.value).reduce((total, count) => total + count, 0)
}

function openCreateStaffDialog() {
  Object.assign(staffForm, { name: '', email: '', password: '', confirmPassword: '', role: 'MODERATOR' })
  createStaffDialogVisible.value = true
}

async function submitStaffAccount() {
  const valid = await staffFormRef.value?.validate().catch(() => false)
  if (!valid) return

  creatingStaff.value = true
  try {
    const { name, email, password, role } = staffForm
    await createStaffUser({ name: name.trim(), email: email.trim(), password, role })
    ElMessage.success(`${role === 'ADMIN' ? 'Administrator' : 'Moderator'} account created.`)
    createStaffDialogVisible.value = false
    selectedUserRole.value = role
    userPage.value = 1
    await loadUsers()
  } catch (err) {
    ElMessage.error(err.response?.data?.message || 'Unable to create staff account.')
  } finally {
    creatingStaff.value = false
  }
}

async function loadSubjects() {
  try {
    subjects.value = await getSubjects()
  } catch (err) {
    ElMessage.error(
      err.response?.data?.message ||
      'Unable to load subjects.',
    )
  }
}

function startSubjectEdit(subject) {
  editingSubjectId.value = subject.id
  subjectCode.value = subject.code
  subjectName.value = subject.name
}

function resetSubjectForm() {
  editingSubjectId.value = null
  subjectCode.value = ''
  subjectName.value = ''
}

function showSubjectCourses(subject) {
  selectedSubjectId.value = Number(subject.id)
  query.value = ''
}

function clearSubjectFilter() {
  selectedSubjectId.value = null
}

async function saveSubject() {
  const code = subjectCode.value.trim().toUpperCase()
  const name = subjectName.value.trim()

  if (!name || (!editingSubjectId.value && !code)) {
    ElMessage.warning('Enter a code and name.')
    return
  }

  subjectSaving.value = true

  try {
    if (editingSubjectId.value) {
      await updateSubject(editingSubjectId.value, name)
    } else {
      await createSubject({ code, name })
    }

    ElMessage.success('Subject saved.')
    resetSubjectForm()
    await loadSubjects()
  } catch (err) {
    ElMessage.error(
      err.response?.data?.message ||
      'Unable to save subject.',
    )
  } finally {
    subjectSaving.value = false
  }
}

onMounted(() => {
  loadCourses()
  loadStats()
  loadUsers()
  loadSubjects()
})
</script>

<template>
  <section class="admin-page">
    <div class="page-heading"><div><p class="eyebrow">ADMIN CONSOLE</p><h1>Administration</h1><p class="muted">Manage courses, subjects, user access, reviews and reports.</p></div></div>
    <div v-if="stats" class="stats-grid">
      <el-card><strong>Users</strong><h2>{{ stats.users }}</h2></el-card>
      <el-card><strong>Courses</strong><h2>{{ stats.courses }}</h2><small>{{ stats.activeCourses }} active</small></el-card>
      <el-card><strong>Reviews</strong><h2>{{ stats.reviews }}</h2><small>{{ stats.pendingReviews }} pending</small></el-card>
      <el-card><strong>Semester plans</strong><h2>{{ stats.plans }}</h2></el-card>
      <el-card><strong>Reports</strong><h2>{{ stats.reports }}</h2><small>{{ stats.pendingReports }} pending</small></el-card>
      <el-card class="moderation-stat"><strong>Review moderation</strong><p>Open the shared queue to manage pending reviews and reports.</p><el-button type="primary" plain @click="$router.push('/moderation')">Open queue</el-button></el-card>
    </div>
    <div class="admin-grid">
      <el-card class="catalogue-card">
        <template #header>
          <div class="card-header">
            <div>
              <strong>Catalogue management</strong>
              <p>Maintain courses and the subjects used to organise them.</p>
            </div>
          </div>
        </template>

        <nav class="subject-nav" aria-label="Course subjects">
          <div class="subject-nav__scroll">
            <button
              type="button"
              class="subject-nav__item"
              :class="{ 'is-active': selectedSubjectId === null }"
              @click="clearSubjectFilter"
            >
              <span>All courses</span>
              <small>{{ courses.length }}</small>
            </button>
            <button
              v-for="subject in subjects"
              :key="subject.id"
              type="button"
              class="subject-nav__item"
              :class="{ 'is-active': selectedSubjectId === Number(subject.id) }"
              @click="showSubjectCourses(subject)"
            >
              <span><b>{{ subject.code }}</b>{{ subject.name }}</span>
              <small>{{ subject._count?.courses ?? 0 }}</small>
            </button>
          </div>
          <el-button class="subject-manage-button" plain @click="subjectDialogVisible = true">Manage subjects</el-button>
        </nav>

        <div class="catalogue-toolbar">
          <div class="catalogue-context">
            <span>{{ selectedSubject ? selectedSubject.code : 'FULL CATALOGUE' }}</span>
            <h3>{{ selectedSubject?.name || 'All courses' }}</h3>
            <p>{{ filteredCourses.length }} course{{ filteredCourses.length === 1 ? '' : 's' }}</p>
          </div>
          <div class="catalogue-actions">
            <el-input v-model="query" clearable placeholder="Search code or name" />
            <el-button type="primary" @click="openCreate">+ Create course</el-button>
          </div>
        </div>

        <el-table v-loading="loading" :data="filteredCourses" max-height="620"><el-table-column prop="code" label="Code" width="120" /><el-table-column prop="name" label="Course" min-width="220" /><el-table-column label="Subject" min-width="150"><template #default="{ row }">{{ row.subject?.name || 'Unassigned' }}</template></el-table-column><el-table-column prop="level" label="Level" width="80" /><el-table-column prop="credits" label="Credits" width="85" /><el-table-column label="Status" width="90"><template #default="{ row }"><el-tag :type="row.isActive ? 'success' : 'info'">{{ row.isActive ? 'Active' : 'Inactive' }}</el-tag></template></el-table-column><el-table-column label="" width="85" fixed="right"><template #default="{ row }"><el-button link type="primary" @click="openEdit(row)">Edit</el-button></template></el-table-column></el-table>
      </el-card>
    </div>
    <el-card class="users-card">
      <template #header>
        <div class="users-header">
          <strong>User management</strong>
          <el-button type="primary" @click="openCreateStaffDialog">+ Create staff account</el-button>
        </div>
      </template>

      <nav class="subject-nav role-nav" aria-label="User roles">
        <div class="subject-nav__scroll">
          <button
            v-for="option in userRoleOptions"
            :key="option.value || 'all'"
            type="button"
            class="subject-nav__item"
            :class="{ 'is-active': selectedUserRole === option.value }"
            @click="selectUserRole(option.value)"
          >
            <span>{{ option.label }}</span>
            <small>{{ getUserRoleCount(option.value) }}</small>
          </button>
        </div>
      </nav>

      <el-table
        v-loading="usersLoading"
        :data="users"
        max-height="520"
      >
        <el-table-column prop="id" label="ID" width="75" />
        <el-table-column prop="name" label="Name" min-width="150" />
        <el-table-column prop="email" label="Email" min-width="220" />
        <el-table-column label="Role" width="165">
          <template #default="{ row }">
            <el-select
              :model-value="row.role"
              :disabled="changingRoleId === row.id"
              @change="role => handleRoleChange(row, role)"
            >
              <el-option label="Student" value="STUDENT" />
              <el-option label="Moderator" value="MODERATOR" />
              <el-option label="Admin" value="ADMIN" />
            </el-select>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="userTotal > 20"
        :current-page="userPage"
        :page-size="20"
        :total="userTotal"
        layout="prev, pager, next"
        @current-change="changeUserPage"
      />
    </el-card>
    <el-dialog v-model="createStaffDialogVisible" title="Create staff account" width="min(520px, 94vw)" :close-on-click-modal="false">
      <p class="staff-dialog-intro">Create a moderator or administrator account. Students register from the public sign-up page.</p>
      <el-form ref="staffFormRef" :model="staffForm" :rules="staffRules" label-position="top">
        <el-form-item label="Name" prop="name">
          <el-input v-model="staffForm.name" autocomplete="name" />
        </el-form-item>
        <el-form-item label="Email" prop="email">
          <el-input v-model="staffForm.email" type="email" autocomplete="email" />
        </el-form-item>
        <el-form-item label="Account role" prop="role">
          <el-select v-model="staffForm.role" style="width:100%">
            <el-option v-for="option in staffRoleOptions" :key="option.value" :label="option.label" :value="option.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="Temporary password" prop="password">
          <el-input v-model="staffForm.password" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="Confirm temporary password" prop="confirmPassword">
          <el-input v-model="staffForm.confirmPassword" type="password" show-password autocomplete="new-password" @keyup.enter="submitStaffAccount" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createStaffDialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="creatingStaff" @click="submitStaffAccount">Create account</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="subjectDialogVisible" title="Manage subjects" width="min(720px, 94vw)" :close-on-click-modal="false" @closed="resetSubjectForm">
      <div class="subject-form">
        <el-input v-model="subjectCode" placeholder="Code, e.g. COMP" :disabled="editingSubjectId !== null" />
        <el-input v-model="subjectName" placeholder="Name, e.g. Computer Science" />
        <el-button type="primary" :loading="subjectSaving" @click="saveSubject">
          {{ editingSubjectId ? 'Save name' : 'Add subject' }}
        </el-button>
        <el-button v-if="editingSubjectId" @click="resetSubjectForm">Cancel</el-button>
      </div>
      <el-table :data="subjects" max-height="420">
        <el-table-column prop="code" label="Code" width="120" />
        <el-table-column prop="name" label="Name" />
        <el-table-column label="Courses" width="100"><template #default="{ row }">{{ row._count?.courses ?? 0 }}</template></el-table-column>
        <el-table-column label="Action" width="100"><template #default="{ row }"><el-button link type="primary" @click="startSubjectEdit(row)">Edit</el-button></template></el-table-column>
      </el-table>
    </el-dialog>
    <el-dialog v-model="dialogVisible" :title="editingId ? 'Edit course' : 'Create course'" width="min(720px, 94vw)" :close-on-click-modal="false"><el-form label-position="top"><div class="form-row"><el-form-item label="Course name"><el-input v-model="courseForm.name" /></el-form-item><el-form-item label="Course code"><el-input v-model="courseForm.code" placeholder="e.g. COMP101" /></el-form-item></div><el-form-item label="Subject"><el-select v-model="courseForm.subjectId" clearable placeholder="Select a subject" style="width:100%"><el-option v-for="subject in subjects" :key="subject.id" :label="`${subject.code} — ${subject.name}`" :value="subject.id" /></el-select></el-form-item><div class="form-row thirds"><el-form-item label="Credits"><el-input-number v-model="courseForm.credits" :min="1" /></el-form-item><el-form-item label="Study hours"><el-input-number v-model="courseForm.workloadHours" :min="1" /></el-form-item><el-form-item label="Level"><el-input-number v-model="courseForm.level" :min="100" :max="900" :step="100" /></el-form-item></div><el-form-item label="Description"><el-input v-model="courseForm.description" type="textarea" :rows="3" /></el-form-item><div class="form-row"><el-form-item label="Offered semesters"><el-select v-model="courseForm.offeredSemesters" multiple style="width:100%"><el-option label="Semester 1" value="SEMESTER_1" /><el-option label="Semester 2" value="SEMESTER_2" /><el-option label="Summer" value="SUMMER" /></el-select></el-form-item><el-form-item label="Assessment types"><el-select v-model="courseForm.assessmentTypes" multiple style="width:100%"><el-option v-for="item in ['EXAM','ASSIGNMENT','QUIZ','PROJECT','LAB','PRESENTATION']" :key="item" :label="item" :value="item" /></el-select></el-form-item></div><el-form-item label="Prerequisites (IDs or exact course codes, comma-separated)"><el-input v-model="prerequisiteIdsInput" placeholder="e.g. 159.101, COMP102" /></el-form-item><el-form-item label="Official course URL"><el-input v-model="courseForm.officialLink" type="url" /></el-form-item><el-form-item v-if="editingId" label="Catalogue status"><el-switch v-model="courseForm.isActive" active-text="Active" inactive-text="Inactive" /></el-form-item></el-form><template #footer><el-button @click="dialogVisible = false">Cancel</el-button><el-button type="primary" :loading="saving" @click="save">{{ editingId ? 'Save changes' : 'Create course' }}</el-button></template></el-dialog>
  </section>
</template>

<style scoped>
.admin-page{max-width:1080px;margin:0 auto}.page-heading{display:flex;align-items:end;justify-content:space-between;gap:20px}.eyebrow{color:var(--accent);font:700 11px/1.4 var(--mono);letter-spacing:.14em}.page-heading h1{margin:6px 0}.muted{color:var(--text);font-size:14px;line-height:1.6}.admin-grid{display:grid;grid-template-columns:1fr;gap:20px;margin-top:28px}.catalogue-card{min-width:0}.card-header{display:flex;align-items:center;justify-content:space-between;gap:20px}.card-header p{margin:5px 0 0;color:var(--text-muted);font-size:13px}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.form-row.thirds{grid-template-columns:repeat(3,1fr)}.form-row :deep(.el-input-number){width:100%}@media(max-width:800px){.page-heading{align-items:start;flex-direction:column}}@media(max-width:560px){.form-row,.form-row.thirds{grid-template-columns:1fr}.card-header{align-items:start;flex-direction:column}}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.stats-grid h2 {
  margin: 8px 0 0;
}

.stats-grid small {
  color: var(--text-muted);
}

.moderation-stat {
  border-color: var(--accent-border);
  background: var(--accent-bg);
}

.moderation-stat p {
  margin: 8px 0 12px;
  color: var(--text);
  font-size: 13px;
  line-height: 1.45;
}

.users-card {
  margin-top: 24px;
}

.users-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.staff-dialog-intro {
  margin: 0 0 18px;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.users-card :deep(.el-pagination) {
  justify-content: flex-end;
  margin-top: 16px;
}

.subject-nav {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: -4px 0 24px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
}

.subject-nav__scroll {
  display: flex;
  flex: 1;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.subject-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  min-height: 42px;
  padding: 8px 13px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  transition: color .18s ease, background .18s ease, border-color .18s ease, transform .18s ease;
}

.subject-nav__item > span {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.subject-nav__item b {
  color: var(--text-h);
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: .04em;
}

.subject-nav__item small {
  display: grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(114, 81, 232, .09);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
}

.subject-nav__item:hover {
  border-color: var(--accent-border);
  background: var(--accent-bg);
  color: var(--accent);
  transform: translateY(-1px);
}

.subject-nav__item.is-active {
  border-color: var(--accent);
  background: var(--accent);
  color: white;
  box-shadow: 0 5px 14px rgba(114, 81, 232, .2);
}

.subject-nav__item.is-active b,
.subject-nav__item.is-active small {
  color: white;
}

.subject-nav__item.is-active small {
  background: rgba(255, 255, 255, .18);
}

.subject-nav__item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.subject-manage-button {
  flex: 0 0 auto;
}

.catalogue-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}

.catalogue-context > span {
  color: var(--accent);
  font: 700 10px/1.3 var(--mono);
  letter-spacing: .12em;
}

.catalogue-context h3 {
  margin: 3px 0 2px;
  color: var(--text-h);
  font-size: 20px;
}

.catalogue-context p {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.catalogue-actions {
  display: flex;
  gap: 10px;
}

.catalogue-actions .el-input {
  width: 300px;
}

.subject-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.subject-form .el-input {
  width: 220px;
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .subject-nav {
    align-items: stretch;
    flex-direction: column;
  }

  .subject-manage-button {
    width: 100%;
  }

  .catalogue-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .catalogue-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .catalogue-actions .el-input,
  .subject-form .el-input {
    width: 100%;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
