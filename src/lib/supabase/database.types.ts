export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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

export type Database = {
  public: {
    Tables: {
      profiles: { Row: ProfilesRow; Insert: ProfilesInsert; Update: ProfilesUpdate; Relationships: [] };
      profile_public: {
        Row: ProfilePublicRow;
        Insert: ProfilePublicInsert;
        Update: ProfilePublicUpdate;
        Relationships: [];
      };
      exams: { Row: ExamsRow; Insert: ExamsInsert; Update: ExamsUpdate; Relationships: [] };
      syllabi: { Row: SyllabiRow; Insert: SyllabiInsert; Update: SyllabiUpdate; Relationships: [] };
      user_exam_subjects: {
        Row: UserExamSubjectsRow;
        Insert: UserExamSubjectsInsert;
        Update: UserExamSubjectsUpdate;
        Relationships: [];
      };
      user_plans: { Row: UserPlansRow; Insert: UserPlansInsert; Update: UserPlansUpdate; Relationships: [] };
      plan_items: { Row: PlanItemsRow; Insert: PlanItemsInsert; Update: PlanItemsUpdate; Relationships: [] };
      groups: { Row: GroupsRow; Insert: GroupsInsert; Update: GroupsUpdate; Relationships: [] };
      group_members: { Row: GroupMembersRow; Insert: GroupMembersInsert; Update: GroupMembersUpdate; Relationships: [] };
      group_messages: { Row: GroupMessagesRow; Insert: GroupMessagesInsert; Update: GroupMessagesUpdate; Relationships: [] };
      quizzes: { Row: QuizzesRow; Insert: QuizzesInsert; Update: QuizzesUpdate; Relationships: [] };
      quiz_questions: { Row: QuizQuestionsRow; Insert: QuizQuestionsInsert; Update: QuizQuestionsUpdate; Relationships: [] };
      user_quiz_results: {
        Row: UserQuizResultsRow;
        Insert: UserQuizResultsInsert;
        Update: UserQuizResultsUpdate;
        Relationships: [];
      };
      notifications: { Row: NotificationsRow; Insert: NotificationsInsert; Update: NotificationsUpdate; Relationships: [] };
      notification_prefs: {
        Row: NotificationPrefsRow;
        Insert: NotificationPrefsInsert;
        Update: NotificationPrefsUpdate;
        Relationships: [];
      };
      subscriptions: { Row: SubscriptionsRow; Insert: SubscriptionsInsert; Update: SubscriptionsUpdate; Relationships: [] };
      badges: { Row: BadgesRow; Insert: BadgesInsert; Update: BadgesUpdate; Relationships: [] };
      user_gamification: {
        Row: UserGamificationRow;
        Insert: UserGamificationInsert;
        Update: UserGamificationUpdate;
        Relationships: [];
      };
      user_xp_events: { Row: UserXpEventsRow; Insert: UserXpEventsInsert; Update: UserXpEventsUpdate; Relationships: [] };
      leaderboard_entries: {
        Row: LeaderboardEntriesRow;
        Insert: LeaderboardEntriesInsert;
        Update: LeaderboardEntriesUpdate;
        Relationships: [];
      };
      success_stories: { Row: SuccessStoriesRow; Insert: SuccessStoriesInsert; Update: SuccessStoriesUpdate; Relationships: [] };
      referral_codes: { Row: ReferralCodesRow; Insert: ReferralCodesInsert; Update: ReferralCodesUpdate; Relationships: [] };
      referrals: { Row: ReferralsRow; Insert: ReferralsInsert; Update: ReferralsUpdate; Relationships: [] };
      parent_links: { Row: ParentLinksRow; Insert: ParentLinksInsert; Update: ParentLinksUpdate; Relationships: [] };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
