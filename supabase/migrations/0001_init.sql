-- ExamForge schema (Supabase / Postgres)

create extension if not exists "pgcrypto";

-- Profiles
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  phone text,
  name text,
  location text,
  timezone text,
  learning_style text,
  level text,
  subscription_tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

-- Exams & syllabi
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  country_code text not null,
  description text,
  subjects jsonb not null default '[]'::jsonb,
  syllabus_sources jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.syllabi (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  topics jsonb not null default '[]'::jsonb,
  source_meta jsonb not null default '{}'::jsonb,
  last_updated timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (exam_id, subject)
);

-- User selections
create table if not exists public.user_exam_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, exam_id, subject)
);

-- Plans
create table if not exists public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete restrict,
  subject text not null,
  mode text not null check (mode in ('solo','group')),
  pace text not null check (pace in ('steady','intensive')),
  start_date date not null,
  target_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.user_plans(id) on delete cascade,
  scheduled_for date not null,
  day_index int not null default 0,
  topic_path text not null,
  title text not null,
  resource_links jsonb not null default '[]'::jsonb,
  status text not null default 'todo' check (status in ('todo','done','skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_plan_items_updated_at on public.plan_items;
create trigger trg_plan_items_updated_at
before update on public.plan_items
for each row execute procedure public.set_updated_at();

create index if not exists idx_plan_items_plan_scheduled on public.plan_items(plan_id, scheduled_for);

-- Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  pace text not null check (pace in ('steady','intensive')),
  level text not null default 'beginner',
  timezone text not null default 'Africa/Lagos',
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_group_messages_group_created on public.group_messages(group_id, created_at desc);

-- Quizzes
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  subject text not null,
  topic_path text not null,
  quiz_type text not null check (quiz_type in ('daily','extra','group')),
  difficulty text not null check (difficulty in ('easy','medium','hard')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index int not null default 0,
  explanation text not null default ''
);

create table if not exists public.user_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score int not null default 0,
  total int not null default 0,
  answers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_quiz_results_user_created on public.user_quiz_results(user_id, created_at desc);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('in_app','sms','whatsapp','email')),
  notif_type text not null check (notif_type in ('reminder','quiz','alert')),
  message text not null,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  provider_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Notification preferences (simple MVP)
create table if not exists public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  channels jsonb not null default '["in_app"]'::jsonb,
  reminder_time text not null default '19:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_notification_prefs_updated_at on public.notification_prefs;
create trigger trg_notification_prefs_updated_at
before update on public.notification_prefs
for each row execute procedure public.set_updated_at();

-- Subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('paystack','stripe')),
  tier text not null check (tier in ('free','pro')),
  status text not null check (status in ('active','canceled','past_due','incomplete')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  , unique (user_id, provider)
);

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute procedure public.set_updated_at();

-- Auth -> profile bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, phone, name, location, subscription_tier)
  values (new.id, new.email, new.phone, coalesce(new.raw_user_meta_data->>'name', null), coalesce(new.raw_user_meta_data->>'location', null), 'free')
  on conflict (user_id) do update
    set email = excluded.email,
        phone = excluded.phone,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_exam_subjects enable row level security;
alter table public.user_plans enable row level security;
alter table public.plan_items enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.user_quiz_results enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.subscriptions enable row level security;

-- Public read for exams/syllabi/quizzes/questions (safe for MVP)
alter table public.exams enable row level security;
alter table public.syllabi enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;

drop policy if exists "exams_read" on public.exams;
create policy "exams_read" on public.exams for select using (true);

drop policy if exists "syllabi_read" on public.syllabi;
create policy "syllabi_read" on public.syllabi for select using (true);

drop policy if exists "quizzes_read" on public.quizzes;
create policy "quizzes_read" on public.quizzes for select using (true);

drop policy if exists "quiz_questions_read" on public.quiz_questions;
create policy "quiz_questions_read" on public.quiz_questions for select using (true);

-- Profiles policies
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles for select using (auth.uid() = user_id);

drop policy if exists "profiles_self_upsert" on public.profiles;
create policy "profiles_self_upsert" on public.profiles
for insert with check (auth.uid() = user_id);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
for update using (auth.uid() = user_id);

-- user_exam_subjects
drop policy if exists "ues_self" on public.user_exam_subjects;
create policy "ues_self" on public.user_exam_subjects
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_plans
drop policy if exists "plans_self" on public.user_plans;
create policy "plans_self" on public.user_plans
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- plan_items: user owns the parent plan
drop policy if exists "plan_items_self" on public.plan_items;
create policy "plan_items_self" on public.plan_items
for all
using (
  exists (
    select 1 from public.user_plans p
    where p.id = plan_items.plan_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.user_plans p
    where p.id = plan_items.plan_id and p.user_id = auth.uid()
  )
);

-- groups: only members can read group details
drop policy if exists "groups_member_read" on public.groups;
create policy "groups_member_read" on public.groups
for select using (
  exists (select 1 from public.group_members gm where gm.group_id = groups.id and gm.user_id = auth.uid())
);

-- group_members: members can read membership list; users can insert themselves (join) if group exists
drop policy if exists "group_members_read" on public.group_members;
create policy "group_members_read" on public.group_members
for select using (
  exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
);

drop policy if exists "group_members_self_join" on public.group_members;
create policy "group_members_self_join" on public.group_members
for insert with check (auth.uid() = user_id);

-- group_messages: members can read and insert
drop policy if exists "group_messages_member_read" on public.group_messages;
create policy "group_messages_member_read" on public.group_messages
for select using (
  exists (select 1 from public.group_members gm where gm.group_id = group_messages.group_id and gm.user_id = auth.uid())
);

drop policy if exists "group_messages_member_insert" on public.group_messages;
create policy "group_messages_member_insert" on public.group_messages
for insert with check (
  auth.uid() = user_id and exists (select 1 from public.group_members gm where gm.group_id = group_messages.group_id and gm.user_id = auth.uid())
);

-- user_quiz_results
drop policy if exists "quiz_results_self" on public.user_quiz_results;
create policy "quiz_results_self" on public.user_quiz_results
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notifications
drop policy if exists "notifications_self" on public.notifications;
create policy "notifications_self" on public.notifications
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notification_prefs
drop policy if exists "notification_prefs_self" on public.notification_prefs;
create policy "notification_prefs_self" on public.notification_prefs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- subscriptions
drop policy if exists "subscriptions_self" on public.subscriptions;
create policy "subscriptions_self" on public.subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
