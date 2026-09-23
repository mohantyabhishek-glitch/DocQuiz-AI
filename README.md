# 📚 DocQuiz AI

> **Turn study notes, documents, and books into interactive, active-recall quizzes in seconds.**

DocQuiz AI extracts text from study notes, textbooks, and documentation across multiple formats (PDF, DOCX, TXT, Markdown, CSV, JSON) and automatically builds tailored multiple-choice quizzes with instant explanations, scoring, and randomized recall practice.

---

## ✨ Features

- **📂 Large File & Multi-Format Ingestion**:
  - Supports uploads up to **100 MB**.
  - Accepts **PDF**, **DOCX**, **DOC**, **TXT**, **Markdown (`.md`)**, **CSV**, and **JSON**.
  - In-memory document processing ensures your study materials remain private in your current session.
- **🎯 Interactive Question Count Selection**:
  - Automatically prompts for desired quiz length upon document upload.
  - Choose between quick presets (**3 Qs** Quick Refresh, **5 Qs** Standard, **7 Qs** Deep Dive, **10 Qs** Mastery) or set any custom length from **1 to 30 questions**.
- **🧠 Fresh & Dynamic Question Generation**:
  - Every time you take a new quiz or request fresh questions, the engine selects different concepts, varies question templates, and shuffles answer option placements (A, B, C, D).
  - One-click **"Get New Questions"** button on the results screen and header to test different sections of the same note without re-uploading.
- **⚡ Active Recall & Instant Feedback**:
  - One-question-at-a-time focus designed to minimize cognitive overload.
  - Immediate visual feedback with detailed reasoning and citations grounded in your source notes.
  - Comprehensive final score recap with an answer review key and retake options.
- **🤖 Smart AI + Local Fallback Engine**:
  - Powered by OpenAI GPT models for contextual reasoning and distractor synthesis.
  - Built-in local fallback quiz generator ensures you can study even without an API key or internet connection.

---

## 🏗️ Architecture & Monorepo Structure

DocQuiz AI is organized as a high-performance **pnpm monorepo workspace**:

```text
DocQuiz-AI/
├── artifacts/
│   ├── docquiz-ai/           # React 19 + Vite 7 Frontend Web Application
│   │   ├── src/pages/        # Home (Upload & Setup) and Quiz (Active Recall Session)
│   │   ├── src/components/   # Design system, App Shell, Dropzone, Question Cards
│   │   └── vite.config.ts    # Vite config with API reverse proxy
│   └── api-server/           # Node.js + Express 5 API Backend
│       ├── src/routes/quiz.ts# Multi-format extractors (pdf-parse, mammoth) & quiz builders
│       └── build.mjs         # esbuild production bundler
├── lib/
│   ├── api-spec/             # OpenAPI 3.1 contract specification
│   ├── api-zod/              # Generated Zod validation schemas
│   └── api-client-react/     # Generated React Query API client hooks
├── package.json              # Workspace root scripts & concurrent runners
└── pnpm-workspace.yaml       # Monorepo workspace configuration
```

---

## 🚀 Quickstart

### 1. Prerequisites
- **Node.js**: v18.0+ (Node 20+ or 24 recommended)
- **Package Manager**: `pnpm` (recommended) or `npm`

### 2. Clone and Install
```bash
git clone https://github.com/mohantyabhishek-glitch/DocQuiz-AI.git
cd DocQuiz-AI
pnpm install
# or
npm install
```

### 3. Configure Environment Variables (Optional)
Create a `.env` file in the root directory (or in `artifacts/api-server/`):
```env
# Optional: Set your OpenAI API key for AI question generation
# If omitted, DocQuiz AI automatically uses the intelligent local fallback engine.
OPENAI_API_KEY=sk-...

# Port settings (defaults: Web -> 3000, API -> 5050)
PORT=5050
```

### 4. Run Development Servers
Start both the Express API server (port `5050`) and Vite Frontend (port `3000`) simultaneously with a single command:

```bash
npm run dev
# or
pnpm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser!

---

## 📜 Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| **`npm run dev`** | `pnpm run dev` | Launches both the API server and Vite Frontend concurrently |
| **`npm run dev:frontend`** | `pnpm --filter @workspace/docquiz-ai run dev` | Starts only the frontend web app (port 3000) |
| **`npm run dev:api`** | `pnpm --filter @workspace/api-server run dev` | Starts only the API backend (port 5050) |
| **`npm run build`** | `pnpm run build` | Runs full typecheck and compiles production bundles |
| **`npm run typecheck`** | `pnpm run typecheck` | Typechecks all workspace packages with TypeScript |

---

## 🔒 Privacy & Data Handling

- Documents uploaded to DocQuiz AI are processed **in-memory** and are never permanently written to disk or third-party databases.
- Extracted notes and active quizzes are preserved locally in browser session storage for seamless study flow and complete privacy.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
