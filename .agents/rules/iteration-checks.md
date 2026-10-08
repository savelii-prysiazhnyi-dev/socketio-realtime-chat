# Iteration Quality Gate & Coding Standards

## 1. Post-Iteration Verification (Mandatory)

After every code modification or iteration in this codebase, run the following quality checks:

### Typecheck
- **Server**: `pnpm --dir server exec tsc --noEmit`
- **Client**: `pnpm --dir client exec tsc --noEmit`

### Lint
- **Server**: `pnpm --dir server run lint`
- **Client**: `pnpm --dir client run lint`

### Format
- **Server**: `pnpm --dir server run format`

All checks must exit with code 0 (zero errors and zero warnings) before concluding any task iteration.

## 2. Zero Code Comments Policy

- **No AI Comments in Code**: Do not write comments (`//` or `/* */`) in any code written or modified by AI across this project.
- **Tool-Generated Scaffolding**: Tool-generated scaffolding comments (e.g. from Vite, Prisma CLI) should remain intact.
- **Self-Documenting Code**: Code must be self-explanatory with descriptive naming conventions, explicit TypeScript interfaces/types, and clean modular structure.
