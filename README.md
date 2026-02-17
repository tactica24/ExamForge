# ACE NAIJA

Production-ready MVP for **ACE NAIJA** - an AI-powered, subscription-based exam prep **PWA**.

## Stack
- **Next.js** (App Router) + TypeScript + Tailwind
- **Firebase** (Auth + Firestore)
- Optional: **OpenAI** (quiz generation + tutor), **Paystack** (billing), Twilio/Resend (notifications)
- **Node.js 22.x** runtime for CI/deploy compatibility

## Quick start
1) Install deps
```bash
npm install
```

2) Create `.env.local` from `.env.example` and set Firebase keys:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- (required for login sessions + Firestore server routes) either:
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  - or `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (recommended)

3) Enable providers in Firebase Console
- Authentication -> Sign-in method -> Email/Password
- Authentication -> Sign-in method -> Google (optional)

4) Run dev server
```bash
npm run dev
```

Open `http://localhost:3000`.

## Key routes
- `/` marketing
- `/signup`, `/login` (email/password + Google OAuth)
- `/onboarding` (exam/subject + plan generation + optional group match)
- `/dashboard`, `/plan`, `/quiz/today`, `/groups`, `/progress`, `/tutor`
- `/billing` (Paystack checkout)
- `/admin` (requires Firebase custom claim `role=admin`)

## Firebase setup notes
- Use Firestore in Native mode.
- The app stores data in collections mirroring feature names (for example `profiles`, `exams`, `syllabi`, `user_plans`, `plan_items`, `quizzes`, `quiz_questions`, `user_quiz_results`, `groups`, `group_members`, `group_messages`).
- Add Firebase admin service-account env vars for cron/admin features, login sessions, parent links, and avatar uploads.

## Vercel setup (recommended path)
1) Create a Firebase Web app and copy:
   - API Key
   - Auth Domain
   - Project ID
   - Storage Bucket
   - Messaging Sender ID
   - App ID
2) Download Firebase service-account JSON (Project Settings -> Service Accounts).
3) Run:
```bash
npm run firebase:env:print -- path/to/serviceAccountKey.json
```
4) Copy the printed values into Vercel Environment Variables (Production + Preview), then redeploy.
5) In Firebase Auth, add your Vercel domain under **Authorized domains**.

## Login troubleshooting
1) Confirm Vercel env vars are set for Production and Preview:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_APP_URL`
   - `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (or `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`)
2) Redeploy after changing env vars.
3) If Google login fails, add your deployed domain under Firebase Authentication authorized domains.
4) If avatar upload fails, set `FIREBASE_STORAGE_BUCKET` (usually `<project-id>.appspot.com`).
5) In production, diagnostics are protected. Run:
```bash
curl -H "x-health-secret: $APP_CRON_SECRET" https://<your-domain>/api/health
```
and confirm `firebase.webConfigReady=true` and `firebase.adminReady=true`.

## Reminders / cron endpoints
```bash
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/reminders
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/leaderboards
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/group-nudges
```

## Deploy on Vercel
- Deploy directly from GitHub on Vercel.
- Keep scheduled tasks outside Vercel using the `Cron Jobs` GitHub workflow.

## Android APK (GitHub Actions)
This repo includes a workflow that builds a debug APK using Capacitor.

### One-time setup
- In GitHub repo settings, set variable `APP_WEB_URL` to your deployed web URL (must start with `https://`).

### Trigger APK build
- Go to **Actions** -> **Android APK**.
- Click **Run workflow**.

### Download APK
- Open the completed workflow run.
- Download artifact `ace-naija-apk-debug`.
- Install `app-debug.apk` on Android (enable install from unknown sources if required).

## Notes / disclaimers
ACE NAIJA is **not** affiliated with WAEC, JAMB, IELTS, ACCA, or ICAN. Content is for preparation only.

## Security hardening implemented
- Strict security headers (CSP, HSTS in production, frame blocking, permissions policy, nosniff, COOP/CORP).
- Same-origin enforcement for state-changing requests in middleware and sensitive routes.
- Rate limiting on login, signup, OTP, session creation, avatar upload, billing init, and logout.
- Firebase session cookies are `httpOnly`, `secure` (production), `sameSite=lax`, high priority, and 24-hour expiry.
- Avatar upload validates file type, max size, and binary signature before storing.

Important: no internet app is 100% hack-proof. Keep dependencies updated, rotate secrets, enforce strong Firebase rules, and monitor logs/alerts continuously.
