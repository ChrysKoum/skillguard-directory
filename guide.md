You are a senior full-stack engineer. Build a production-quality hackathon MVP called:

SkillGuard Directory — Trust Layer for Agent Skills (OpenClaw / Antigravity Skills compatible)

GOAL
Ship a publicly accessible web app (Vercel deploy) in 5 days that:
1) Shows a curated directory of agent skills (seed data ok).
2) Lets users scan a public GitHub repo URL (or upload a zip) representing a “skill”.
3) Produces:
   - A deterministic “Nutrition Label” (capabilities/permissions + risk flags)
   - A Gemini “Deep Audit” structured report (findings + evidence + attack chain)
   - Exportable artifacts: skillguard.policy.json and verification_plan.md
4) Assigns “Verified” badges (Bronze/Silver/Pinned).
5) Includes a credible Antigravity integration stub: /antigravity-skill/SKILL.md describing SkillGuard as an Antigravity Skill.

NON-GOALS (avoid time traps)
- No full marketplace with accounts/submissions/moderation.
- No real sandbox execution or malware behavior.
- No heavy crawling of entire codebases; create a “scan pack” and cap inputs.

STACK
- Next.js 14+ App Router (TypeScript)
- Tailwind for styling
- Supabase (Postgres + Storage)
- API calls: Gemini 3 via Google Gemini API (use server-side only, never expose keys)
- Deployed to Vercel

DELIVERABLES
- Working deployed site with public URL (no login required)
- Public GitHub repo containing code and setup instructions
- Demo seed: at least 20 skills in directory (can be placeholders + a few real repos)
- 3 demo repos/bundles for video: safe / suspicious / “dangerous-pattern simulated”

APP PAGES
1) "/" Directory
   - List skills with: name, badges, risk level, capability chips
   - Filters: capability (shell/network/fs/browser), risk level, verified badge
   - Search box
2) "/scan" Scan page
   - Input: GitHub repo URL
   - Optional: Upload zip
   - CTA: Scan
3) "/skill/[id]" Skill detail page
   Sections:
   - Nutrition Label (capabilities, sensitive paths, outbound domains, risk flags)
   - Deep Audit (Gemini findings list + attack chain)
   - Verified badge + reasons
   - Download artifacts: policy JSON + verification plan MD
   - “Rescan” button

DATA MODEL (Supabase)
Create tables via SQL migration.

Table: skills
- id uuid pk default gen_random_uuid()
- name text not null
- slug text unique not null
- source_url text not null
- source_type text not null default 'github'
- created_at timestamptz default now()
- updated_at timestamptz default now()

Table: scans
- id uuid pk default gen_random_uuid()
- skill_id uuid references skills(id) on delete cascade
- status text not null check in ('queued','running','done','error')
- commit_sha text null
- scan_pack_json jsonb not null default '{}'
- static_json jsonb not null default '{}'
- deep_json jsonb not null default '{}'
- risk_level text null check in ('low','medium','high')
- verified_badge text null check in ('none','bronze','silver','pinned')
- error_text text null
- created_at timestamptz default now()

Table: artifacts
- id uuid pk default gen_random_uuid()
- scan_id uuid references scans(id) on delete cascade
- type text not null check in ('policy_json','verification_md','patch_diff')
- storage_path text not null
- created_at timestamptz default now()

Supabase Storage bucket: "skillguard"
Paths:
- skillguard/{scan_id}/policy.json
- skillguard/{scan_id}/verification_plan.md
- skillguard/{scan_id}/patch.diff (optional)

SERVER ROUTES (Next.js Route Handlers)
- POST /api/scan
  body: { sourceUrl?: string, zipBase64?: string }
  returns: { skillId, scanId }
  behavior:
   1) create or upsert skill record
   2) create scan row status=running
   3) run ingestion + static scan + deep audit
   4) generate artifacts, upload to storage
   5) set risk_level, verified_badge, status=done
  IMPORTANT: must be robust, return errors with scanId.

- GET /api/skill/[id]
  returns: skill + latest scan + artifacts URLs

- POST /api/rescan/[id]
  triggers new scan for existing skill

INGESTION (GitHub)
For public repos:
- Use GitHub HTTPS “download zip” method:
  https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip
Fallback: if branch unknown, try main then master.
Parse:
- SKILL.md if exists (case-insensitive)
- README.md fallback
- list of file paths
- extract top suspicious snippets from:
  - SKILL.md / README install instructions
  - scripts (*.sh, *.ps1, package.json scripts, etc.) [only sample small files]
CAP INPUT SIZE: create a scan_pack with:
- skill_markdown (up to 40k chars)
- file_tree (array of file paths up to 2000)
- suspicious_snippets (max 30 snippets, each max 400 chars)
- extracted_domains (max 200)
- detected_commands (max 50)

STATIC ANALYZER (deterministic)
Compute:
capabilities: array subset of:
- "shell" (commands found, scripts, instructions)
- "filesystem_read" (mentions or code patterns reading env/home)
- "network" (urls/domains, http clients)
- "browser_data" (mentions of browser profile, cookies, automation libs)
sensitive_paths: list of matched patterns:
- .env, ~/.ssh, /Users/*/Library/Application Support, AppData, etc.
outbound_domains: from URLs
risk_flags: array of objects { code, severity, evidence }
Static risk scoring:
- critical if curl|bash or powershell -enc or base64 decode+exec patterns
- high if reads .env or ~/.ssh + network exfil domains
- medium if broad permissions w/ unclear purpose
Output static_json:
{
  capabilities: string[],
  sensitive_paths: string[],
  outbound_domains: string[],
  risk_flags: [{code, severity, evidence}],
  static_score: number
}

GEMINI DEEP AUDIT (structured JSON only)
Call Gemini 3 (server-side). Provide scan_pack_json + static_json.
Prompt must demand strict JSON matching this schema:

DeepAudit schema:
{
  "risk_level": "low|medium|high",
  "summary": string,
  "findings": [
    {
      "title": string,
      "severity": "low|medium|high|critical",
      "why_it_matters": string,
      "evidence": [
        {"source": "SKILL.md|README|file", "file": string|null, "line": number|null, "snippet": string}
      ],
      "recommended_fix": string
    }
  ],
  "attack_chain": string[],
  "safe_run_checklist": string[],
  "policy_suggestions": {
    "allow_domains": string[],
    "deny_paths": string[],
    "tool_restrictions": string[]
  },
  "verification_plan": {
    "preflight_checks": string[],
    "runtime_checks": string[],
    "postrun_checks": string[]
  },
  "patch_diff": string|null
}

Then:
- Set scans.deep_json = DeepAudit
- risk_level = DeepAudit.risk_level
- Generate artifacts:
  - policy.json from policy_suggestions with project-defined format
  - verification_plan.md from verification_plan as markdown sections
  - patch.diff if patch_diff present

VERIFIED BADGE LOGIC
- bronze: static analyzer has no critical flags
- silver: deep risk_level != high AND no finding severity critical
- pinned: silver + commit_sha present (optional) + store scan hash

UI REQUIREMENTS
- Clean, professional dashboard-style UI
- All outputs should be readable: chips, severity tags, accordion for evidence
- Provide “Copy” buttons for policy and checklist
- Artifacts should be downloadable via signed URLs from Supabase storage

SECURITY / QUALITY
- Never expose API keys in client.
- Rate limit scan endpoint minimally (simple in-memory limit ok for MVP).
- Cache results by source_url+commit_sha.
- Handle GitHub fetch failures cleanly.
- Use zod for input validation.
- Use eslint/prettier defaults.

REPO STRUCTURE
- /app (Next pages)
- /app/api (route handlers)
- /lib (supabase client, github fetch, scanners, gemini)
- /antigravity-skill/SKILL.md (integration stub)
- /prisma optional NOT needed if using Supabase SQL directly

WHAT TO DELIVER FIRST (implementation order)
1) Supabase schema + basic pages + /api/scan stub
2) GitHub zip fetch + parse SKILL.md/README + file tree
3) Static analyzer + nutrition label UI
4) Gemini deep audit + findings UI
5) Artifact export + verified badges + directory filters
6) Compare view (optional)
7) Polish + deploy

OUTPUT
- Provide code changes with file paths.
- Provide the Supabase SQL migration.
- Provide the Gemini prompt templates in /lib/gemini/prompts.ts.
- Provide a README with deploy steps and environment variables.

ENV VARS
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (server only)
- SUPABASE_ANON_KEY (client ok if needed)
- GEMINI_API_KEY (server only)

NOW START by generating:
1) Supabase SQL migration for the tables and constraints.
2) Next.js file skeleton with routes and placeholders.
3) lib modules: github.ts, staticScan.ts, geminiAudit.ts, artifacts.ts, supabase.ts.
