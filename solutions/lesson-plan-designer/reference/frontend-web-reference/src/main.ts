import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { setupAntd } from './plugins/antd'
import './assets/styles/base.css'
import './assets/styles/pages.css'

// Set document title from environment variable
document.title = import.meta.env.VITE_APP_TITLE || '师范生发展平台'

const app = createApp(App)
const pinia = createPinia()

// Setup Ant Design Vue (grid components only)
setupAntd(app)

app.use(pinia)
app.use(router)
app.mount('#app')
