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
  created_at: string;
  updated_at: string;
};
export type ProfilesInsert = Partial<ProfilesRow> & { user_id: string };
export type ProfilesUpdate = Partial<ProfilesRow>;

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
  user_id: string;
  content: string;
  flagged: boolean;
  created_at: string;
};
export type GroupMessagesInsert = Partial<GroupMessagesRow> & { group_id: string; user_id: string; content: string };
export type GroupMessagesUpdate = Partial<GroupMessagesRow>;

export type QuizzesRow = {
  id: string;
  exam_id: string;
  subject: string;
  topic_path: string;
  quiz_type: "daily" | "extra" | "group" | string;
  difficulty: "easy" | "medium" | "hard" | string;
  created_by: string | null;
  created_at: string;
};
export type QuizzesInsert = Partial<QuizzesRow> & {
  exam_id: string;
  subject: string;
  topic_path: string;
  quiz_type: "daily" | "extra" | "group";
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
      profiles: TableDef<ProfilesRow, ProfilesInsert, ProfilesUpdate>;
      exams: TableDef<ExamsRow, ExamsInsert, ExamsUpdate>;
      syllabi: TableDef<SyllabiRow, SyllabiInsert, SyllabiUpdate>;
      user_exam_subjects: {
        Row: UserExamSubjectsRow;
        Insert: UserExamSubjectsInsert;
        Update: UserExamSubjectsUpdate;
        Relationships: [];
      };
      user_plans: TableDef<UserPlansRow, UserPlansInsert, UserPlansUpdate>;
      plan_items: TableDef<PlanItemsRow, PlanItemsInsert, PlanItemsUpdate>;
      groups: TableDef<GroupsRow, GroupsInsert, GroupsUpdate>;
      group_members: TableDef<GroupMembersRow, GroupMembersInsert, GroupMembersUpdate>;
      group_messages: TableDef<GroupMessagesRow, GroupMessagesInsert, GroupMessagesUpdate>;
      quizzes: TableDef<QuizzesRow, QuizzesInsert, QuizzesUpdate>;
      quiz_questions: TableDef<QuizQuestionsRow, QuizQuestionsInsert, QuizQuestionsUpdate>;
      user_quiz_results: TableDef<UserQuizResultsRow, UserQuizResultsInsert, UserQuizResultsUpdate>;
      notifications: TableDef<NotificationsRow, NotificationsInsert, NotificationsUpdate>;
      notification_prefs: TableDef<NotificationPrefsRow, NotificationPrefsInsert, NotificationPrefsUpdate>;
      subscriptions: TableDef<SubscriptionsRow, SubscriptionsInsert, SubscriptionsUpdate>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

