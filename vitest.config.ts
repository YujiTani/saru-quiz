import { defineConfig } from 'vitest/config'

// 単体テスト用。PWA プラグインなどは入れない
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
