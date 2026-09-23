# DocQuiz AI

DocQuiz AI turns uploaded PDF and TXT study notes into interactive multiple-choice quizzes with instant feedback and explanations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/docquiz-ai/` — React/Vite web app, upload flow, quiz session, and local session storage
- `artifacts/api-server/src/routes/quiz.ts` — document extraction, bounded chunking, provider generation, and fallback behavior
- `lib/api-spec/openapi.yaml` — source of truth for extraction and quiz-generation contracts
- `artifacts/docquiz-ai/src/index.css` — DocQuiz visual tokens and responsive layout utilities

## Architecture decisions

- PDF/TXT bytes are processed in memory and are not persisted; the browser keeps the current extracted document and quiz in local session storage.
- Text over 12,000 characters is split on logical boundaries; multi-section documents are summarized section-by-section before quiz generation.
- OpenAI generation uses bounded JSON-only chat completions with low temperature and explicit output limits.
- If an AI provider is unavailable, the API returns a clearly marked local fallback quiz rather than blocking the study flow.

## Product

- Drag-and-drop or file-picker upload for PDF and TXT notes
- Safe extraction metrics, scanned-PDF warning, and document readiness state
- Configurable 3/5/7/10-question quiz generation
- One-question-at-a-time recall practice with immediate answer feedback
- Final score recap and restart flow

## User preferences

None recorded.

## Gotchas

- The API server is mounted at `/api`; frontend API calls should use the generated client hooks rather than hardcoded service ports.
- The frontend workflow supplies `PORT` and `BASE_PATH`; run the managed workflow for preview rather than starting Vite without those variables.
- The AI provider key is read from `OPENAI_API_KEY`; provider errors are intentionally sanitized before returning to the browser.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
