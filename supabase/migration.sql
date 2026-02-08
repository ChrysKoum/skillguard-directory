-- ============================================
-- SKILLGUARD DATABASE MIGRATION
-- ============================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This is a complete, idempotent migration script.
-- ============================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. SKILLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  source_url text NOT NULL,
  source_type text NOT NULL DEFAULT 'github',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. SCANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.scans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  skill_id uuid REFERENCES public.skills(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'ingesting', 'analysis', 'done', 'done_with_warnings', 'error')),
  commit_sha text,
  scan_pack_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  static_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  deep_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high')),
  verified_badge text CHECK (verified_badge IN ('paper', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'obsidian', 'none')),
  error_text text,
  created_at timestamptz DEFAULT now(),
  -- Progress tracking columns
  stage_status jsonb DEFAULT '{"static": "pending", "deep": "pending"}'::jsonb,
  progress_msg text,
  deep_model_used text,
  warnings jsonb DEFAULT '[]'::jsonb,
  deep_raw_text text
);

-- Add any missing columns (idempotent - safe to run multiple times)
DO $$ 
BEGIN
  -- stage_status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'stage_status') THEN
    ALTER TABLE public.scans ADD COLUMN stage_status jsonb DEFAULT '{"static": "pending", "deep": "pending"}'::jsonb;
  END IF;
  
  -- progress_msg
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'progress_msg') THEN
    ALTER TABLE public.scans ADD COLUMN progress_msg text;
  END IF;
  
  -- deep_model_used
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'deep_model_used') THEN
    ALTER TABLE public.scans ADD COLUMN deep_model_used text;
  END IF;
  
  -- warnings
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'warnings') THEN
    ALTER TABLE public.scans ADD COLUMN warnings jsonb DEFAULT '[]'::jsonb;
  END IF;
  
  -- deep_raw_text
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'scans' AND column_name = 'deep_raw_text') THEN
    ALTER TABLE public.scans ADD COLUMN deep_raw_text text;
  END IF;
END $$;

-- Update status constraint to include new statuses
ALTER TABLE public.scans DROP CONSTRAINT IF EXISTS scans_status_check;
ALTER TABLE public.scans ADD CONSTRAINT scans_status_check 
  CHECK (status IN ('queued', 'running', 'ingesting', 'analysis', 'done', 'done_with_warnings', 'error'));

-- ============================================
-- 3. ARTIFACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.artifacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id uuid REFERENCES public.scans(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('policy_json', 'verification_md', 'patch_diff')),
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_skills_slug ON public.skills(slug);
CREATE INDEX IF NOT EXISTS idx_scans_skill_id ON public.scans(skill_id);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON public.scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_status ON public.scans(status);

-- ============================================
-- 5. STORAGE BUCKET
-- ============================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('skillguard', 'skillguard', true) 
ON CONFLICT DO NOTHING;

-- Storage policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Service Insert" ON storage.objects;

CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'skillguard');

CREATE POLICY "Service Insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'skillguard');

-- ============================================
-- 6. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read skills" ON public.skills;
CREATE POLICY "Allow public read skills" ON public.skills FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service insert skills" ON public.skills;
CREATE POLICY "Allow service insert skills" ON public.skills FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service update skills" ON public.skills;
CREATE POLICY "Allow service update skills" ON public.skills FOR UPDATE USING (true);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read scans" ON public.scans;
CREATE POLICY "Allow public read scans" ON public.scans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service insert scans" ON public.scans;
CREATE POLICY "Allow service insert scans" ON public.scans FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow service update scans" ON public.scans;
CREATE POLICY "Allow service update scans" ON public.scans FOR UPDATE USING (true);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read artifacts" ON public.artifacts;
CREATE POLICY "Allow public read artifacts" ON public.artifacts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow service insert artifacts" ON public.artifacts;
CREATE POLICY "Allow service insert artifacts" ON public.artifacts FOR INSERT WITH CHECK (true);

-- ============================================
-- 7. COMMENTS (Documentation)
-- ============================================
COMMENT ON TABLE public.skills IS 'Registered AI agent skills/tools';
COMMENT ON TABLE public.scans IS 'Security scan results for skills';
COMMENT ON TABLE public.artifacts IS 'Generated artifacts (policy files, verification docs)';

COMMENT ON COLUMN public.scans.stage_status IS 'Progress tracking: {"static": "done", "deep": "scanning", "msg": "Analyzing..."}';
COMMENT ON COLUMN public.scans.progress_msg IS 'Human-readable progress message for UI display';
COMMENT ON COLUMN public.scans.deep_model_used IS 'Which Gemini model completed the deep audit';
COMMENT ON COLUMN public.scans.warnings IS 'Array of warning messages (e.g., truncation notices)';

-- ============================================
-- DONE!
-- ============================================
SELECT 'Migration complete! ✅' AS status;
