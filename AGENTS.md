# Project Guidelines

## Quality Verification After Every Iteration

After making any code changes in this project, you must run the following checks and verify that they succeed with 0 errors:

1. **Typecheck**:
   - Server: `pnpm --dir server exec tsc --noEmit`
   - Client: `pnpm --dir client exec tsc --noEmit`

2. **Lint**:
   - Server: `pnpm --dir server run lint`
   - Client: `pnpm --dir client run lint`

3. **Format**:
   - Server: `pnpm --dir server run format`

## Zero Comments Policy

- Do not add comments (`//` or `/* */`) to code files written or modified by AI in this project.
- Write clean, self-describing code using clear identifiers, types, and modular functions.
- Preserve tool-generated scaffolding comments (e.g. Prisma schema banners), but never add AI-generated commentary.
