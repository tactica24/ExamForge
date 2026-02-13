# ExamForge

Production-ready MVP for **ExamForge** — an AI-powered, subscription-based exam prep **PWA** (Nigeria-first, global-ready).

## Stack
- **Next.js** (App Router) + TypeScript + Tailwind
- **Supabase** (Auth + Postgres + Realtime)
- Optional: **OpenAI** (quiz generation + tutor), **Paystack** (billing), Twilio/Resend (notifications)

## Quick start
1) Install deps
```bash
npm install
```

2) Create a Supabase project and run the SQL:
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_engagement.sql`
- `supabase/seed.sql`

3) Create `.env.local` from `.env.example` and set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (recommended) `SUPABASE_SERVICE_ROLE_KEY` (for admin/cron/seed automation)
- (optional) `OPENAI_API_KEY`
- (optional) `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY` + `PAYSTACK_CALLBACK_URL`
- (optional) `APP_CRON_SECRET`
- (optional) `RESEND_FROM_EMAIL` (if using Resend)

4) Run dev server
```bash
npm run dev
```

Open `http://localhost:3000`.

## Key routes
- `/` marketing
- `/signup`, `/login` (email/password + Google OAuth)
- `/login/otp`, `/login/verify` (phone OTP; requires SMS configured in Supabase)
- `/onboarding` (exam/subject + plan generation + optional group match)
- `/dashboard`, `/plan`, `/quiz/today`, `/groups`, `/progress`, `/tutor`
- `/billing` (Paystack checkout)
- `/admin` (set `app_metadata.role=admin` in Supabase)

## Reminders (cron)
Call:
```bash
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/reminders
```

This checks `notification_prefs` and inserts `notifications` rows (and stubs provider sending).

## Leaderboards + nudges (cron)
```bash
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/leaderboards
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/group-nudges
```

## Offline support
- Quizzes can be saved offline and synced later via `/api/quizzes/sync`.
- Plan snapshot is cached via `/api/offline/snapshot` and the service worker.

## Notes / disclaimers
ExamForge is **not** affiliated with WAEC, JAMB, IELTS, ACCA, or ICAN. Content is for preparation only.
