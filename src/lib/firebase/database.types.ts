export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppSettingsRow = {
  id: string;
  logo_url: string | null;
  updated_at: string;
  updated_by: string | null;
};
export type AppSettingsInsert = Partial<AppSettingsRow> & { id: string };
export type AppSettingsUpdate = Partial<AppSettingsRow>;

export type ProfilesRow = {
  user_id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  location: string | null;
  timezone: string | null;
  learning_style: string | null;
  level: string | null;
  subscription_tier: "free" | "pro" | string;
  display_name: string | null;
  preferred_explanation_language: string;
  low_data_mode: boolean;
  leaderboard_anonymous: boolean;
  pro_until: string | null;
  created_at: string;
  updated_at: string;
};
export type ProfilesInsert = Partial<ProfilesRow> & { user_id: string };
export type ProfilesUpdate = Partial<ProfilesRow>;

export type ProfilePublicRow = {
  user_id: string;
  display_name: string | null;
  anonymous: boolean;
  created_at: string;
  updated_at: string;
};
export type ProfilePublicInsert = Partial<ProfilePublicRow> & { user_id: string };
export type ProfilePublicUpdate = Partial<ProfilePublicRow>;

export type ExamsRow = {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  description: string | null;
  subjects: Json;
  syllabus_sources: Json;
  is_active: boolean;
  created_at: string;
};
export type ExamsInsert = Partial<ExamsRow> & { slug: string; name: string; country_code: string };
export type ExamsUpdate = Partial<ExamsRow>;

export type CareersRow = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  courses: Json;
  workplaces: Json;
  jamb_subjects: Json;
  keywords: Json;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type CareersInsert = Partial<CareersRow> & {
  slug: string;
  title: string;
  category: string;
  summary: string;
};
export type CareersUpdate = Partial<CareersRow>;

export type SyllabiRow = {
  id: string;
  exam_id: string;
  subject: string;
  topics: Json;
  source_meta: Json;
  last_updated: string;
  created_at: string;
};
export type SyllabiInsert = Partial<SyllabiRow> & { exam_id: string; subject: string; topics: Json };
export type SyllabiUpdate = Partial<SyllabiRow>;

export type QuestionBankRunsRow = {
  id: string;
  exam_id: string;
  exam_slug: string | null;
  subject: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  total_requested: number;
  total_generated: number;
  total_approved: number;
  total_needs_review: number;
  total_rejected: number;
  config: Json;
  summary: Json;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type QuestionBankRunsInsert = Partial<QuestionBankRunsRow> & {
  exam_id: string;
  subject: string;
};
export type QuestionBankRunsUpdate = Partial<QuestionBankRunsRow>;

export type QuestionBankEntriesRow = {
  id: string;
  run_id: string | null;
  exam_id: string;
  exam_slug: string | null;
  subject: string;
  topic_path: string;
  topic_key: string | null;
  focus_label: string | null;
  focus_key: string | null;
  difficulty: "easy" | "medium" | "hard" | string;
  question: string;
  options: Json;
  correct_index: number;
  explanation: string;
  syllabus_tags: Json;
  quality_score: number;
  review_score: number;
  review_status: "approved" | "rejected" | "needs_review" | string;
  review_notes: Json;
  source_model: string | null;
  source_provider: string | null;
  source_type: string | null;
  signature: string;
  meta: Json;
  created_at: string;
  updated_at: string;
};
export type QuestionBankEntriesInsert = Partial<QuestionBankEntriesRow> & {
  exam_id: string;
  subject: string;
  topic_path: string;
  question: string;
  options: Json;
  correct_index: number;
  explanation: string;
  signature: string;
};
export type QuestionBankEntriesUpdate = Partial<QuestionBankEntriesRow>;

export type UserExamSubjectsRow = {
  id: string;
  user_id: string;
  exam_id: string;
  subject: string;
  is_active: boolean;
  created_at: string;
};
export type UserExamSubjectsInsert = Partial<UserExamSubjectsRow> & {
  user_id: string;
  exam_id: string;
  subject: string;
};
export type UserExamSubjectsUpdate = Partial<UserExamSubjectsRow>;

export type UserPlansRow = {
  id: string;
  user_id: string;
  exam_id: string;
  subject: string;
  mode: "solo" | "group" | string;
  pace: "steady" | "intensive" | string;
  start_date: string;
  target_date: string | null;
  weak_areas: Json;
  created_at: string;
};
export type UserPlansInsert = Partial<UserPlansRow> & {
  user_id: string;
  exam_id: string;
  subject: string;
  mode: "solo" | "group";
  pace: "steady" | "intensive";
  start_date: string;
};
export type UserPlansUpdate = Partial<UserPlansRow>;

export type PlanItemsRow = {
  id: string;
  plan_id: string;
  scheduled_for: string;
  day_index: number;
  topic_path: string;
  title: string;
  resource_links: Json;
  status: "todo" | "done" | "skipped" | string;
  created_at: string;
  updated_at: string;
};
export type PlanItemsInsert = Partial<PlanItemsRow> & {
  plan_id: string;
  scheduled_for: string;
  day_index: number;
  topic_path: string;
  title: string;
};
export type PlanItemsUpdate = Partial<PlanItemsRow>;

export type GroupsRow = {
  id: string;
  exam_id: string;
  subject: string;
  pace: "steady" | "intensive" | string;
  level: string;
  timezone: string;
  name?: string | null;
  created_at: string;
};
export type GroupsInsert = Partial<GroupsRow> & {
  exam_id: string;
  subject: string;
  pace: "steady" | "intensive";
  level: string;
  timezone: string;
};
export type GroupsUpdate = Partial<GroupsRow>;

export type GroupMembersRow = {
  group_id: string;
  user_id: string;
  role: "member" | "moderator" | string;
  joined_at: string;
};
export type GroupMembersInsert = { group_id: string; user_id: string; role?: "member" | "moderator" };
export type GroupMembersUpdate = Partial<GroupMembersRow>;

export type GroupMessagesRow = {
  id: string;
  group_id: string;
  user_id: string | null;
  content: string;
  flagged: boolean;
  is_system: boolean;
  created_at: string;
};
export type GroupMessagesInsert = Partial<GroupMessagesRow> & {
  group_id: string;
  user_id?: string | null;
  content: string;
};
export type GroupMessagesUpdate = Partial<GroupMessagesRow>;

export type TutorThreadsRow = {
  id: string;
  user_id: string;
  exam_id: string | null;
  exam: string | null;
  subject: string | null;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};
export type TutorThreadsInsert = Partial<TutorThreadsRow> & { user_id: string; title: string };
export type TutorThreadsUpdate = Partial<TutorThreadsRow>;

export type TutorMessagesRow = {
  id: string;
  thread_id: string;
  user_id: string;
  role: "user" | "assistant" | string;
  content: string;
  created_at: string;
};
export type TutorMessagesInsert = Partial<TutorMessagesRow> & {
  thread_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
};
export type TutorMessagesUpdate = Partial<TutorMessagesRow>;

export type ContactRequestsRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  topic: string | null;
  message: string;
  source: string | null;
  status: "new" | "handled" | string;
  assigned_admin_id: string | null;
  assigned_admin_email: string | null;
  assigned_at: string | null;
  handled_at: string | null;
  resolution_notes: string | null;
  created_at: string;
};
export type ContactRequestsInsert = Partial<ContactRequestsRow> & { message: string };
export type ContactRequestsUpdate = Partial<ContactRequestsRow>;

export type QuizzesRow = {
  id: string;
  exam_id: string;
  subject: string;
  topic_path: string;
  quiz_type: "daily" | "extra" | "group" | "mock" | string;
  difficulty: "easy" | "medium" | "hard" | string;
  created_by: string | null;
  meta: Json;
  created_at: string;
};
export type QuizzesInsert = Partial<QuizzesRow> & {
  exam_id: string;
  subject: string;
  topic_path: string;
  quiz_type: "daily" | "extra" | "group" | "mock";
  difficulty: "easy" | "medium" | "hard";
};
export type QuizzesUpdate = Partial<QuizzesRow>;

export type QuizQuestionsRow = {
  id: string;
  quiz_id: string;
  question: string;
  options: Json;
  correct_index: number;
  explanation: string;
};
export type QuizQuestionsInsert = Partial<QuizQuestionsRow> & {
  quiz_id: string;
  question: string;
  options: Json;
  correct_index: number;
  explanation: string;
};
export type QuizQuestionsUpdate = Partial<QuizQuestionsRow>;

export type UserQuizResultsRow = {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
  answers: Json;
  created_at: string;
};
export type UserQuizResultsInsert = Partial<UserQuizResultsRow> & {
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
};
export type UserQuizResultsUpdate = Partial<UserQuizResultsRow>;

export type NotificationsRow = {
  id: string;
  user_id: string;
  channel: "in_app" | "sms" | "whatsapp" | "email" | string;
  notif_type: "reminder" | "quiz" | "alert" | string;
  message: string;
  scheduled_for: string;
  sent_at: string | null;
  status: "queued" | "sent" | "failed" | string;
  provider_meta: Json;
  created_at: string;
};
export type NotificationsInsert = Partial<NotificationsRow> & {
  user_id: string;
  channel: "in_app" | "sms" | "whatsapp" | "email";
  notif_type: "reminder" | "quiz" | "alert";
  message: string;
  scheduled_for: string;
};
export type NotificationsUpdate = Partial<NotificationsRow>;

export type NotificationPrefsRow = {
  user_id: string;
  channels: Json;
  reminder_time: string;
  reminders?: Json;
  created_at: string;
  updated_at: string;
};
export type NotificationPrefsInsert = Partial<NotificationPrefsRow> & { user_id: string };
export type NotificationPrefsUpdate = Partial<NotificationPrefsRow>;

export type BadgesRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  xp_required: number;
  criteria: Json;
  created_at: string;
};
export type BadgesInsert = Partial<BadgesRow> & { slug: string; name: string; description: string };
export type BadgesUpdate = Partial<BadgesRow>;

export type UserGamificationRow = {
  user_id: string;
  streak_count: number;
  current_streak_date: string | null;
  total_xp: number;
  level: number;
  badges: Json;
  created_at: string;
  updated_at: string;
};
export type UserGamificationInsert = Partial<UserGamificationRow> & { user_id: string };
export type UserGamificationUpdate = Partial<UserGamificationRow>;

export type UserXpEventsRow = {
  id: string;
  user_id: string;
  xp: number;
  reason: string;
  meta: Json;
  created_at: string;
};
export type UserXpEventsInsert = Partial<UserXpEventsRow> & { user_id: string; xp: number; reason: string };
export type UserXpEventsUpdate = Partial<UserXpEventsRow>;

export type LeaderboardEntriesRow = {
  id: string;
  user_id: string;
  period: "weekly" | "monthly" | "all_time" | string;
  score: number;
  rank: number;
  computed_at: string;
};
export type LeaderboardEntriesInsert = Partial<LeaderboardEntriesRow> & {
  user_id: string;
  period: "weekly" | "monthly" | "all_time";
};
export type LeaderboardEntriesUpdate = Partial<LeaderboardEntriesRow>;

export type SuccessStoriesRow = {
  id: string;
  content: string;
  created_by: string | null;
  is_anonymous: boolean;
  is_approved: boolean;
  created_at: string;
};
export type SuccessStoriesInsert = Partial<SuccessStoriesRow> & { content: string };
export type SuccessStoriesUpdate = Partial<SuccessStoriesRow>;

export type ReferralCodesRow = { user_id: string; code: string; created_at: string };
export type ReferralCodesInsert = Partial<ReferralCodesRow> & { user_id: string; code: string };
export type ReferralCodesUpdate = Partial<ReferralCodesRow>;

export type ReferralsRow = {
  id: string;
  inviter_user_id: string;
  invitee_user_id: string;
  code: string;
  created_at: string;
};
export type ReferralsInsert = Partial<ReferralsRow> & {
  inviter_user_id: string;
  invitee_user_id: string;
  code: string;
};
export type ReferralsUpdate = Partial<ReferralsRow>;

export type ParentLinksRow = {
  token: string;
  user_id: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
  last_viewed_at: string | null;
};
export type ParentLinksInsert = Partial<ParentLinksRow> & { user_id: string };
export type ParentLinksUpdate = Partial<ParentLinksRow>;

export type SubscriptionsRow = {
  id: string;
  user_id: string;
  provider: "paystack" | "stripe" | string;
  tier: "free" | "pro" | string;
  status: "active" | "canceled" | "past_due" | "incomplete" | string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};
export type SubscriptionsInsert = Partial<SubscriptionsRow> & {
  user_id: string;
  provider: "paystack" | "stripe";
  tier: "free" | "pro";
  status: "active" | "canceled" | "past_due" | "incomplete";
};
export type SubscriptionsUpdate = Partial<SubscriptionsRow>;

type TableDef<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      app_settings: TableDef<AppSettingsRow, AppSettingsInsert, AppSettingsUpdate>;
      careers: TableDef<CareersRow, CareersInsert, CareersUpdate>;
      profiles: TableDef<ProfilesRow, ProfilesInsert, ProfilesUpdate>;
      profile_public: TableDef<ProfilePublicRow, ProfilePublicInsert, ProfilePublicUpdate>;
      exams: TableDef<ExamsRow, ExamsInsert, ExamsUpdate>;
      syllabi: TableDef<SyllabiRow, SyllabiInsert, SyllabiUpdate>;
      question_bank_runs: TableDef<QuestionBankRunsRow, QuestionBankRunsInsert, QuestionBankRunsUpdate>;
      question_bank_entries: TableDef<QuestionBankEntriesRow, QuestionBankEntriesInsert, QuestionBankEntriesUpdate>;
      user_exam_subjects: TableDef<UserExamSubjectsRow, UserExamSubjectsInsert, UserExamSubjectsUpdate>;
      user_plans: TableDef<UserPlansRow, UserPlansInsert, UserPlansUpdate>;
      plan_items: TableDef<PlanItemsRow, PlanItemsInsert, PlanItemsUpdate>;
      groups: TableDef<GroupsRow, GroupsInsert, GroupsUpdate>;
      group_members: TableDef<GroupMembersRow, GroupMembersInsert, GroupMembersUpdate>;
      group_messages: TableDef<GroupMessagesRow, GroupMessagesInsert, GroupMessagesUpdate>;
      tutor_threads: TableDef<TutorThreadsRow, TutorThreadsInsert, TutorThreadsUpdate>;
      tutor_messages: TableDef<TutorMessagesRow, TutorMessagesInsert, TutorMessagesUpdate>;
      contact_requests: TableDef<ContactRequestsRow, ContactRequestsInsert, ContactRequestsUpdate>;
      quizzes: TableDef<QuizzesRow, QuizzesInsert, QuizzesUpdate>;
      quiz_questions: TableDef<QuizQuestionsRow, QuizQuestionsInsert, QuizQuestionsUpdate>;
      user_quiz_results: TableDef<UserQuizResultsRow, UserQuizResultsInsert, UserQuizResultsUpdate>;
      notifications: TableDef<NotificationsRow, NotificationsInsert, NotificationsUpdate>;
      notification_prefs: TableDef<NotificationPrefsRow, NotificationPrefsInsert, NotificationPrefsUpdate>;
      subscriptions: TableDef<SubscriptionsRow, SubscriptionsInsert, SubscriptionsUpdate>;
      badges: TableDef<BadgesRow, BadgesInsert, BadgesUpdate>;
      user_gamification: TableDef<UserGamificationRow, UserGamificationInsert, UserGamificationUpdate>;
      user_xp_events: TableDef<UserXpEventsRow, UserXpEventsInsert, UserXpEventsUpdate>;
      leaderboard_entries: TableDef<LeaderboardEntriesRow, LeaderboardEntriesInsert, LeaderboardEntriesUpdate>;
      success_stories: TableDef<SuccessStoriesRow, SuccessStoriesInsert, SuccessStoriesUpdate>;
      referral_codes: TableDef<ReferralCodesRow, ReferralCodesInsert, ReferralCodesUpdate>;
      referrals: TableDef<ReferralsRow, ReferralsInsert, ReferralsUpdate>;
      parent_links: TableDef<ParentLinksRow, ParentLinksInsert, ParentLinksUpdate>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
