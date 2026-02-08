-- Migration: Upgrade 'scans' table for 3-Stage Pipeline & Robustness

-- 1. Add new columns for tracking pipeline stages and fallback models
ALTER TABLE public.scans
ADD COLUMN IF NOT EXISTS stage_status JSONB DEFAULT '{"static": "pending", "deep": "pending"}'::jsonb,
ADD COLUMN IF NOT EXISTS deep_model_used TEXT,
ADD COLUMN IF NOT EXISTS warnings JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS deep_raw_text TEXT;

-- 2. Update status enum constraint to include 'done_with_warnings'
-- First, drop the existing check constraint if it strictly enforces the old enum
ALTER TABLE public.scans
DROP CONSTRAINT IF EXISTS scans_status_check;

-- Re-add constraint with new allowed values
ALTER TABLE public.scans
ADD CONSTRAINT scans_status_check
CHECK (status IN ('queued', 'running', 'done', 'done_with_warnings', 'error'));

-- 3. Comment on columns for documentation
COMMENT ON COLUMN public.scans.stage_status IS 'Tracks progress of static vs deep analysis e.g. {"static": "done", "deep": "rate_limited"}';
COMMENT ON COLUMN public.scans.deep_model_used IS 'The actual model version used (e.g. gemini-3-flash-preview) after fallback logic';
COMMENT ON COLUMN public.scans.warnings IS 'List of non-fatal warnings e.g. ["Deep audit rate limited", "File truncated"]';
