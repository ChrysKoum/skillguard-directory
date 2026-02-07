-- Enable Extensions
create extension if not exists "uuid-ossp";

-- 1. Skills Table
create table if not exists public.skills (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  source_url text not null,
  source_type text not null default 'github',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Scans Table
create table if not exists public.scans (
  id uuid primary key default uuid_generate_v4(),
  skill_id uuid references public.skills(id) on delete cascade,
  status text not null check (status in ('queued','running','done','error')),
  commit_sha text,
  scan_pack_json jsonb not null default '{}'::jsonb,
  static_json jsonb not null default '{}'::jsonb,
  deep_json jsonb not null default '{}'::jsonb,
  risk_level text check (risk_level in ('low','medium','high')),
  verified_badge text check (verified_badge in ('none','bronze','silver','pinned')),
  error_text text,
  created_at timestamptz default now()
);

-- 3. Artifacts Table
create table if not exists public.artifacts (
  id uuid primary key default uuid_generate_v4(),
  scan_id uuid references public.scans(id) on delete cascade,
  type text not null check (type in ('policy_json','verification_md','patch_diff')),
  storage_path text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_skills_slug on public.skills(slug);
create index if not exists idx_scans_skill_id on public.scans(skill_id);
create index if not exists idx_scans_created_at on public.scans(created_at desc);

-- STORAGE BUCKET
-- Note: Buckets are usually created via UI or Storage API, but policy is SQL.
-- We assume bucket 'skillguard' exists.
-- Policy for Storage
insert into storage.buckets (id, name, public) values ('skillguard', 'skillguard', true) on conflict do nothing;

create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'skillguard' );

create policy "Service Insert"
  on storage.objects for insert
  with check ( bucket_id = 'skillguard' ); -- Auth role check needed usually, but logic is server-side service role.

-- RLS (Tables)
alter table public.skills enable row level security;
create policy "Allow public read skills" on public.skills for select using (true);
create policy "Allow service insert skills" on public.skills for insert with check (true); -- Service role bypasses RLS anyway but good to have explicit if we ever use anon.

alter table public.scans enable row level security;
create policy "Allow public read scans" on public.scans for select using (true);

alter table public.artifacts enable row level security;
create policy "Allow public read artifacts" on public.artifacts for select using (true);
