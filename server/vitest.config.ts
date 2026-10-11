import { existsSync } from 'node:fs';
import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

dotenv.config({
  path: existsSync('.env.test') ? '.env.test' : '.env.test.example',
  override: true,
});

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
  },
});
