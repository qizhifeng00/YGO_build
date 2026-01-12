import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // 可选：优化打包配置（针对生产环境）
  // build: {
  //   // 禁用代码拆分，确保所有 JS 合并为一个（插件会进一步内联到 HTML）
  //   rollupOptions: {
  //     output: {
  //       manualChunks: () => 'singleChunk.js'
  //     }
  //   },
  //   // 禁用资源映射文件（可选，减少冗余）
  //   sourcemap: false
  // }
})

