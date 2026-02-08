# SkillGuard: The Trust Layer for AI Agents

**SkillGuard** is a "Nutrition Label" generator and Deep Security Auditor for AI Agent Skills. Built for the **Gemini 3 Hackathon**, it leverages the **1M token context window** of `gemini-3.0-pro` (or experimental equivalent) to perform whole-codebase analysis of agent tools.

## 🚀 Hackathon Tracks
- **Action Era**: We don't just prompt; we ingest entire repositories, parse capabilities, and orchestrate a multi-stage audit pipeline.
- **Vibe Engineering**: We build the *trust layer* that allows users to safely "vibe check" new agents. We generate `verification_plan.md` artifacts specifically designed for human-in-the-loop verification.

## ✨ Features
1.  **Deep Ingestion**: Fetches GitHub zips and processes up to 800k tokens of code.
2.  **Static Analysis**: Deterministic detection of capabilities (Network, FS, Shell) and "Vibe Flags" (e.g., `curl | bash`).
3.  **Gemini Deep Audit**: Uses `gemini-3.0-pro` to trace data flow and identify logical vulnerabilities.
4.  **Artifact Generation**: Produces `policy.json` (runtime enforcement) and `verification_plan.md` (manual testing).

## 🛠️ Tech Stack
-   **Framework**: Next.js 16 (App Router)
-   **Language**: TypeScript
-   **Database**: Supabase (PostgreSQL + Storage)
-   **AI**: Google Generative AI SDK (`gemini-2.0-flash-exp` / `gemini-3.0-pro`)
-   **UI**: Tailwind CSS + Lucide React

## 📦 Setup

1.  **Clone & Install**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    Copy `.env.local.example` to `.env.local` and fill in:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
    SUPABASE_SECRET_KEY=...
    GEMINI_API_KEY=...
    ```

3.  **Database Migration**
    Run the SQL in `supabase/migration.sql` in your Supabase SQL Editor.

4.  **Seed Data (Optional)**
    ```bash
    npx tsx seed.ts
    ```

5.  **Run Dev**
    ```bash
    npm run dev
    ```

## 🛡️ Antigravity Integration
This project includes a `SKILL.md` definition in `antigravity-skill/`, allowing it to be used *by* other Antigravity agents to self-audit or audit peers.
