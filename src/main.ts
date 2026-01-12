import { createApp } from 'vue'
import App from './App.vue'

// 导入naive-ui
import naive from 'naive-ui'

const app = createApp(App)
app.use(naive)
app.mount('#app')

