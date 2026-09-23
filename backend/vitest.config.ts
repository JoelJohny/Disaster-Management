import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The suite talks to one shared MySQL container, so the files must not
    // race each other for the same seed rows.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: { DB_HOST: '127.0.0.1', DB_PORT: '3307', SERVE_STATIC: 'false' },
  },
});
