import { defineConfig } from 'vitest/config';

// Dev-only test configuration. This file is not loaded by the published
// static site; it only configures the Vitest harness used in development.
export default defineConfig({
  test: {
    // The site code runs in the browser, so tests run against a DOM.
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js', 'js/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: ['js/gift-registry.js'],
      reporter: ['text', 'html'],
    },
  },
});
