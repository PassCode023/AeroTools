import { defineConfig } from 'vitest/config'

// 单测只跑纯逻辑（tests/ 下），不加载 uni-app 的 vite 插件链
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
