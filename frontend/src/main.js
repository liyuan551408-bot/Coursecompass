import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  ElAlert, ElButton, ElCard, ElCheckbox, ElDatePicker, ElDialog, ElEmpty,
  ElForm, ElFormItem, ElInput, ElInputNumber, ElLoading, ElOption,
  ElRadio, ElRadioGroup, ElRate, ElResult, ElSelect, ElSlider, ElSwitch, ElTable,
  ElTableColumn, ElTag,
} from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
for (const component of [
  ElAlert, ElButton, ElCard, ElCheckbox, ElDatePicker, ElDialog, ElEmpty,
  ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElRadio, ElRadioGroup,
  ElRate, ElResult, ElSelect, ElSlider, ElSwitch, ElTable, ElTableColumn, ElTag,
]) {
  app.component(component.name, component)
}
app.use(ElLoading)

const authStore = useAuthStore()
authStore.restoreSession()

app.mount('#app')
