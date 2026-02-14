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
## Android APK (GitHub Actions)
This repo includes a workflow that builds a debug APK using Capacitor.

### One-time setup
- In GitHub repo settings, set variable `APP_WEB_URL` to your deployed web URL (for example, your Vercel production URL).

### Trigger APK build
- Go to **Actions** -> **Android APK**.
- Click **Run workflow**.

### Download APK
- Open the completed workflow run.
- Download artifact `examforge-apk-debug`.
- Install `app-debug.apk` on Android (enable install from unknown sources if required).

### Mobile helper scripts
- `npm run mobile:android:prepare`
- `npm run mobile:android:add`
- `npm run mobile:android:sync`
- `npm run mobile:android:assets`
- `npm run mobile:android:open`

## Mobile wrapper troubleshooting
- If the app shows **deployment temporarily paused**, the mobile wrapper is pointing to a paused or protected URL.
- In GitHub repo settings, set `APP_WEB_URL` to your active **production** Vercel URL (must start with `https://`).
- You can override URL per run from **Actions -> Android APK -> Run workflow -> app_web_url**.
- If Vercel paused the project, unpause it in Vercel dashboard before rebuilding the APK.

## Temporary app logo
- Save your attached logo into `assets/logo.png` (or `.jpg/.jpeg/.svg`).
- Re-run **Android APK** workflow; it now auto-generates Android icons from `assets/`.

