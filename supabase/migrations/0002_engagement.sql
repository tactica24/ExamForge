-- ExamForge enhancements: gamification, personalization, referrals, parent links, leaderboards, and community feed.

create extension if not exists "pgcrypto";

-- Profiles: preferences + leaderboard identity + pro trials
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists preferred_explanation_language text not null default 'en',
  add column if not exists low_data_mode boolean not null default false,
  add column if not exists leaderboard_anonymous boolean not null default false,
  add column if not exists pro_until timestamptz;

-- Public profile subset (safe to expose in leaderboards)
create table if not exists public.profile_public (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  anonymous boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profile_public_updated_at on public.profile_public;
create trigger trg_profile_public_updated_at
before update on public.profile_public
for each row execute procedure public.set_updated_at();

alter table public.profile_public enable row level security;
drop policy if exists "profile_public_read" on public.profile_public;
create policy "profile_public_read" on public.profile_public for select using (true);
drop policy if exists "profile_public_self_write" on public.profile_public;
create policy "profile_public_self_write" on public.profile_public
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Plans: weak areas tracking
alter table public.user_plans
  add column if not exists weak_areas jsonb not null default '{}'::jsonb;

-- Quizzes: extra metadata (mock exams, personalization)
alter table public.quizzes
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Expand quiz_type to include "mock"
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'quizzes_quiz_type_check') then
    alter table public.quizzes drop constraint quizzes_quiz_type_check;
  end if;
end $$;
alter table public.quizzes
  add constraint quizzes_quiz_type_check check (quiz_type in ('daily','extra','group','mock'));

-- Group messages: allow system messages (cron nudges)
alter table public.group_messages
  add column if not exists is_system boolean not null default false;

alter table public.group_messages
  alter column user_id drop not null;

-- Gamification
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon_url text,
  xp_required int not null default 0,
  criteria jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_gamification (
  user_id uuid primary key references auth.users(id) on delete cascade,
  streak_count int not null default 0,
  current_streak_date date,
  total_xp int not null default 0,
  level int not null default 1,
  badges jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_gamification_updated_at on public.user_gamification;
create trigger trg_user_gamification_updated_at
before update on public.user_gamification
for each row execute procedure public.set_updated_at();

create table if not exists public.user_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  xp int not null,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_xp_events_user_created on public.user_xp_events(user_id, created_at desc);

create table if not exists public.leaderboard_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('weekly','monthly','all_time')),
  score int not null default 0,
  rank int not null default 0,
  computed_at timestamptz not null default now(),
  unique (user_id, period)
);

-- Community feed: success stories
create table if not exists public.success_stories (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  created_by uuid references auth.users(id) on delete set null,
  is_anonymous boolean not null default true,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Referrals + parent view
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  invitee_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  unique (invitee_user_id)
);

create table if not exists public.parent_links (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_viewed_at timestamptz
);

-- RLS
alter table public.badges enable row level security;
alter table public.user_gamification enable row level security;
alter table public.user_xp_events enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.success_stories enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.parent_links enable row level security;

drop policy if exists "badges_read" on public.badges;
create policy "badges_read" on public.badges for select using (true);

drop policy if exists "user_gamification_self" on public.user_gamification;
create policy "user_gamification_self" on public.user_gamification
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_xp_events_self" on public.user_xp_events;
create policy "user_xp_events_self" on public.user_xp_events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "leaderboard_read" on public.leaderboard_entries;
create policy "leaderboard_read" on public.leaderboard_entries for select using (true);

drop policy if exists "stories_read_approved" on public.success_stories;
create policy "stories_read_approved" on public.success_stories for select using (is_approved = true);

drop policy if exists "stories_self_insert" on public.success_stories;
create policy "stories_self_insert" on public.success_stories for insert with check (auth.uid() = created_by);

drop policy if exists "referral_codes_self" on public.referral_codes;
create policy "referral_codes_self" on public.referral_codes
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "referrals_read" on public.referrals;
create policy "referrals_read" on public.referrals for select using (auth.uid() = invitee_user_id or auth.uid() = inviter_user_id);

drop policy if exists "parent_links_self" on public.parent_links;
create policy "parent_links_self" on public.parent_links
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Seed badges and curated stories
insert into public.badges (slug, name, description, icon_url, xp_required, criteria)
values
  ('first-quiz','First Quiz','Completed your first quiz.',null,0,'{"type":"quiz_count","count":1}'::jsonb),
  ('streak-3','3-Day Streak','Studied 3 days in a row.',null,0,'{"type":"streak","days":3}'::jsonb),
  ('streak-7','7-Day Streak','Studied 7 days in a row.',null,0,'{"type":"streak","days":7}'::jsonb),
  ('streak-14','14-Day Streak','Studied 14 days in a row.',null,0,'{"type":"streak","days":14}'::jsonb),
  ('xp-200','200 XP','Earned 200 XP.',null,200,'{"type":"xp","xp":200}'::jsonb),
  ('xp-500','500 XP','Earned 500 XP.',null,500,'{"type":"xp","xp":500}'::jsonb)
on conflict (slug) do nothing;

insert into public.success_stories (content, created_by, is_anonymous, is_approved)
values
  ('I kept a 7-day streak and my mock score jumped from 42% to 68%. Small daily wins work.', null, true, true),
  ('Group mode helped me stay accountable. We did 10 questions nightly and it changed everything.', null, true, true),
  ('I stopped cramming and followed the plan. I remembered more with less stress.', null, true, true)
on conflict do nothing;

