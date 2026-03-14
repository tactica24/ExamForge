-- Aurora PostgreSQL migration target for the current ACE NAIJA application.
-- Timestamps and date-like values are intentionally stored as ISO-8601 text
-- during the migration phase so the existing application logic can move over
-- without reworking all string-based comparisons at once.

create extension if not exists pgcrypto;

create table if not exists app_settings (
  id text primary key,
  logo_url text,
  updated_at text not null,
  updated_by text
);

create table if not exists profiles (
  user_id text primary key,
  email text,
  phone text,
  name text,
  location text,
  timezone text,
  learning_style text,
  level text,
  subscription_tier text not null default 'free',
  display_name text,
  preferred_explanation_language text not null default 'en',
  low_data_mode boolean not null default false,
  leaderboard_anonymous boolean not null default false,
  pro_until text,
  avatar_url text,
  exam_interest_slugs jsonb not null default '[]'::jsonb,
  country text,
  state text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists uq_profiles_email_ci
  on profiles (lower(email))
  where email is not null;

create index if not exists idx_profiles_created_at
  on profiles (created_at desc);

create table if not exists profile_public (
  user_id text primary key,
  display_name text,
  anonymous boolean not null default false,
  created_at text not null,
  updated_at text not null
);

create table if not exists exams (
  id text primary key default gen_random_uuid()::text,
  slug text not null,
  name text not null,
  country_code text not null,
  description text,
  subjects jsonb not null default '[]'::jsonb,
  syllabus_sources jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at text not null
);

create unique index if not exists uq_exams_slug
  on exams (slug);

create table if not exists syllabi (
  id text primary key default gen_random_uuid()::text,
  exam_id text not null references exams(id) on delete cascade,
  subject text not null,
  topics jsonb not null default '[]'::jsonb,
  source_meta jsonb not null default '{}'::jsonb,
  last_updated text not null,
  created_at text not null
);

create unique index if not exists uq_syllabi_exam_subject
  on syllabi (exam_id, subject);

create table if not exists user_exam_subjects (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  exam_id text not null references exams(id) on delete cascade,
  subject text not null,
  is_active boolean not null default true,
  created_at text not null
);

create unique index if not exists uq_user_exam_subjects_triplet
  on user_exam_subjects (user_id, exam_id, subject);

create table if not exists user_plans (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  exam_id text not null references exams(id) on delete cascade,
  subject text not null,
  mode text not null,
  pace text not null,
  start_date text not null,
  target_date text,
  weak_areas jsonb not null default '[]'::jsonb,
  created_at text not null
);

create index if not exists idx_user_plans_user
  on user_plans (user_id, created_at desc);

create table if not exists plan_items (
  id text primary key default gen_random_uuid()::text,
  plan_id text not null references user_plans(id) on delete cascade,
  scheduled_for text not null,
  day_index integer not null,
  topic_path text not null,
  title text not null,
  resource_links jsonb not null default '[]'::jsonb,
  status text not null default 'todo',
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_plan_items_plan_schedule
  on plan_items (plan_id, scheduled_for, day_index, created_at);

create table if not exists groups (
  id text primary key default gen_random_uuid()::text,
  exam_id text not null references exams(id) on delete cascade,
  subject text not null,
  pace text not null,
  level text not null,
  timezone text not null,
  name text,
  created_at text not null
);

create index if not exists idx_groups_exam_subject
  on groups (exam_id, subject, created_at desc);

create table if not exists group_members (
  group_id text not null references groups(id) on delete cascade,
  user_id text not null,
  role text not null default 'member',
  joined_at text not null,
  primary key (group_id, user_id)
);

create index if not exists idx_group_members_user
  on group_members (user_id, joined_at desc);

create table if not exists group_messages (
  id text primary key default gen_random_uuid()::text,
  group_id text not null references groups(id) on delete cascade,
  user_id text,
  content text not null,
  flagged boolean not null default false,
  is_system boolean not null default false,
  created_at text not null
);

create index if not exists idx_group_messages_group_created
  on group_messages (group_id, created_at desc);

create table if not exists tutor_threads (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  exam_id text,
  exam text,
  subject text,
  title text not null,
  created_at text not null,
  updated_at text not null,
  last_message_at text
);

create index if not exists idx_tutor_threads_user_last_message
  on tutor_threads (user_id, last_message_at desc, updated_at desc);

create table if not exists tutor_messages (
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references tutor_threads(id) on delete cascade,
  user_id text not null,
  role text not null,
  content text not null,
  created_at text not null
);

create index if not exists idx_tutor_messages_thread_created
  on tutor_messages (thread_id, created_at asc);

create table if not exists contact_requests (
  id text primary key default gen_random_uuid()::text,
  user_id text,
  name text,
  email text,
  topic text,
  message text not null,
  source text,
  status text not null default 'new',
  assigned_admin_id text,
  assigned_admin_email text,
  assigned_at text,
  handled_at text,
  resolution_notes text,
  created_at text not null
);

create index if not exists idx_contact_requests_status_created
  on contact_requests (status, created_at desc);

create table if not exists quizzes (
  id text primary key default gen_random_uuid()::text,
  exam_id text not null references exams(id) on delete cascade,
  subject text not null,
  topic_path text not null,
  quiz_type text not null,
  difficulty text not null,
  created_by text,
  meta jsonb not null default '{}'::jsonb,
  created_at text not null
);

create index if not exists idx_quizzes_exam_subject_created
  on quizzes (exam_id, subject, created_at desc);

create table if not exists quiz_questions (
  id text primary key default gen_random_uuid()::text,
  quiz_id text not null references quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_index integer not null,
  explanation text not null
);

create table if not exists user_quiz_results (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  quiz_id text not null references quizzes(id) on delete cascade,
  score integer not null,
  total integer not null,
  answers jsonb not null default '[]'::jsonb,
  created_at text not null
);

create index if not exists idx_user_quiz_results_user_created
  on user_quiz_results (user_id, created_at desc);

create table if not exists notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  channel text not null,
  notif_type text not null,
  message text not null,
  scheduled_for text not null,
  sent_at text,
  status text not null default 'queued',
  provider_meta jsonb not null default '{}'::jsonb,
  created_at text not null
);

create index if not exists idx_notifications_status_created
  on notifications (status, created_at asc);

create index if not exists idx_notifications_reminder_key
  on notifications ((provider_meta ->> 'reminder_key'));

create table if not exists notification_prefs (
  user_id text primary key,
  channels jsonb not null default '{}'::jsonb,
  reminder_time text not null default '18:00',
  reminders jsonb not null default '{}'::jsonb,
  created_at text not null,
  updated_at text not null
);

create table if not exists subscriptions (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  provider text not null,
  tier text not null,
  status text not null,
  current_period_end text,
  paystack_reference text,
  paystack_paid_at text,
  created_at text not null,
  updated_at text not null
);

create unique index if not exists uq_subscriptions_user_provider
  on subscriptions (user_id, provider);

create table if not exists badges (
  id text primary key default gen_random_uuid()::text,
  slug text not null,
  name text not null,
  description text not null,
  icon_url text,
  xp_required integer not null default 0,
  criteria jsonb not null default '{}'::jsonb,
  created_at text not null
);

create unique index if not exists uq_badges_slug
  on badges (slug);

create table if not exists user_gamification (
  user_id text primary key,
  streak_count integer not null default 0,
  current_streak_date text,
  total_xp integer not null default 0,
  level integer not null default 1,
  badges jsonb not null default '[]'::jsonb,
  created_at text not null,
  updated_at text not null
);

create index if not exists idx_user_gamification_total_xp
  on user_gamification (total_xp desc);

create table if not exists user_xp_events (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  xp integer not null,
  reason text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at text not null
);

create index if not exists idx_user_xp_events_user_created
  on user_xp_events (user_id, created_at desc);

create table if not exists leaderboard_entries (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  period text not null,
  score integer not null,
  rank integer not null,
  computed_at text not null
);

create unique index if not exists uq_leaderboard_entries_user_period
  on leaderboard_entries (user_id, period);

create table if not exists success_stories (
  id text primary key default gen_random_uuid()::text,
  content text not null,
  created_by text,
  is_anonymous boolean not null default false,
  is_approved boolean not null default false,
  created_at text not null
);

create table if not exists referral_codes (
  user_id text primary key,
  code text not null,
  created_at text not null
);

create unique index if not exists uq_referral_codes_code
  on referral_codes (code);

create table if not exists referrals (
  id text primary key default gen_random_uuid()::text,
  inviter_user_id text not null,
  invitee_user_id text not null,
  code text not null,
  created_at text not null
);

create unique index if not exists uq_referrals_invitee
  on referrals (invitee_user_id);

create table if not exists parent_links (
  token text primary key,
  user_id text not null,
  label text,
  created_at text not null,
  revoked_at text,
  last_viewed_at text
);

create table if not exists auth_sessions (
  id text primary key,
  user_id text not null,
  email text,
  device_id text not null,
  user_agent text,
  ip_address text,
  created_at text not null,
  last_seen_at text not null,
  revoked_at text,
  revoked_reason text
);

create index if not exists idx_auth_sessions_user_active
  on auth_sessions (user_id, revoked_at, created_at desc);

create table if not exists billing_events (
  id text primary key,
  user_id text not null,
  provider text not null,
  reference text not null,
  source text not null,
  status text not null,
  amount_kobo bigint not null,
  currency text not null,
  paid_at text,
  received_at text not null,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists uq_billing_events_reference
  on billing_events (reference);

create table if not exists ai_jobs (
  id text primary key,
  job_type text not null,
  status text not null,
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after text not null,
  created_by text,
  result_meta jsonb,
  last_error text,
  started_at text,
  completed_at text,
  created_at text not null
);

create index if not exists idx_ai_jobs_status_run_after
  on ai_jobs (status, run_after, created_at asc);

create table if not exists study_assets_cache (
  cache_key text primary key,
  exam_id text not null references exams(id) on delete cascade,
  subject text not null,
  topic_path text not null,
  topic_title text not null,
  topic_key text not null,
  preferred_language text not null,
  lesson jsonb,
  assets jsonb not null default '{}'::jsonb,
  created_at text not null,
  updated_at text not null
);

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  reset_at bigint not null,
  updated_at text not null
);
