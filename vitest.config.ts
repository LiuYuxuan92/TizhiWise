import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'apps/**/*.spec.ts',
      'apps/**/*.int.spec.ts',
      'packages/**/*.spec.ts',
      'packages/**/*.int.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['**/dist/**', '**/*.d.ts', '**/*.config.*'],
    },
  },
});
