import { execSync } from 'node:child_process';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Refusing to wipe database: NODE_ENV is not "test"');
}

execSync('pnpm exec prisma migrate reset --force', {
  stdio: 'inherit',
  env: {
    ...process.env,
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
  },
});
