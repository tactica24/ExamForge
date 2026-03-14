# ACE NAIJA

Production-ready MVP for **ACE NAIJA** - an AI-powered, subscription-based exam prep **PWA**.

## Stack
- **Next.js** (App Router) + TypeScript + Tailwind
- **AWS Amplify** (hosting) + **Cognito** (auth)
- **Aurora PostgreSQL Serverless v2** (app data via Data API) + **Amazon S3** (uploads/assets)
- Optional: **OpenAI** (quiz generation + tutor), **Paystack** (billing), Twilio/Resend (notifications)
- **Node.js 22.x** runtime for CI/deploy compatibility

## Quick start
1) Install deps
```bash
npm install
```

2) Create `.env.local` from `.env.example` and set the AWS auth/runtime values:
- `APP_BACKEND_PROVIDER=aws`
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`
- `COGNITO_APP_CLIENT_SECRET`
- `COGNITO_DOMAIN`
- `COGNITO_CALLBACK_URL`
- `COGNITO_LOGOUT_URL`
- `APP_SESSION_SECRET`
- `AURORA_CLUSTER_ARN`
- `AURORA_SECRET_ARN`
- `AURORA_DATABASE`
- `S3_BUCKET_NAME`
- `S3_REGION`
- `NEXT_PUBLIC_APP_URL`
- For AI generation, also set `OPENAI_API_KEY`

3) Run dev server
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
- `/admin` and `/admin/users` (requires `profiles.role=admin`)

## Auth and role notes
- Google sign-in now starts from `/api/auth/cognito/start` and completes at `/api/auth/cognito/callback`.
- New signup confirmation uses the Cognito email code flow on the login page, and users must verify their email before a session is created.
- Admin access is stored in the app profile record via `profiles.role`.

## OpenAI integration and syllabus-first flow
1) Set `OPENAI_API_KEY` in local `.env.local` and in your AWS environment, then redeploy.
2) Check readiness:
```bash
curl https://www.acenaija.com.ng/api/health
```
Expect: `status: "ok"`, then test the tutor or explanation flows from the app.
3) In admin, open `/admin/exams/<examId>` and use:
- `Generate selected subject` for one subject
- `Generate all subjects` to prebuild syllabus for the full exam
4) Onboarding and quiz generation also call syllabus loading automatically. If AI is unavailable, stored fallback syllabus is used so planning still works.

## Paystack live setup
1) Set these env vars in your AWS environment, then redeploy:
   - `PAYSTACK_SECRET_KEY` (live secret key)
   - `PAYSTACK_PUBLIC_KEY` (live public key)
   - `PAYSTACK_CALLBACK_URL` (for example `https://<your-domain>/billing/callback`)
2) In Paystack dashboard, set webhook URL to:
   - `https://<your-domain>/api/billing/paystack/webhook`
3) Keep `APP_CRON_SECRET` configured; webhook and callback now both activate Pro access after Paystack server-side verification.

## Cron endpoints
```bash
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/leaderboards
```
Optional/manual endpoints:
```bash
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/reminders
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/group-nudges
curl -H "x-cron-secret: $APP_CRON_SECRET" http://localhost:3000/api/cron/ai-jobs
```

## Deploy on AWS
- Deploy the Next.js standalone build to your AWS runtime of choice.
- Weekly leaderboard recompute is scheduled via the `Cron Jobs` GitHub workflow.

## Deploy on Amplify
- This repo now includes [`amplify.yml`](./amplify.yml) plus `npm run amplify:env:write` so Amplify build-time variables are copied into `.env.production` before `next build`.
- Put all app env vars in Amplify environment variables, including every `NEXT_PUBLIC_*` value and the server-side secrets the app needs.
- The AWS-native backend migration target, cutover checklist, and Aurora schema live in [`docs/aws-native-migration.md`](./docs/aws-native-migration.md) and [`infra/aws/aurora/schema.sql`](./infra/aws/aurora/schema.sql).
- For AWS infrastructure automation, use [`infra/aws/cloudformation/backend-foundation.yaml`](./infra/aws/cloudformation/backend-foundation.yaml) and [`scripts/aws-stack-export-env.mjs`](./scripts/aws-stack-export-env.mjs) to provision Cognito/SES/Aurora/S3 and export Amplify-ready env values.
- To auto-apply the Aurora schema after provisioning, use [`scripts/aws-apply-schema.mjs`](./scripts/aws-apply-schema.mjs).

## Android APK (GitHub Actions)
This repo includes a workflow that builds a debug APK using Capacitor.

### One-time setup
- In GitHub repo settings, set variable `APP_WEB_URL` to your deployed web URL (must start with `https://`).
- Current production URL: `https://www.acenaija.com.ng`
- Do not leave placeholder domains in `capacitor.config.json`; the workflow now fails if `APP_WEB_URL` is missing.

### Trigger APK build
- Go to **Actions** -> **Android APK**.
- Click **Run workflow**.

### Local Android build (optional)
```bash
npm run mobile:url:set -- https://<your-domain>
npm run mobile:android:sync
```

### Download APK
- Open the completed workflow run.
- Download artifact `ace-naija-apk-debug`.
- Install `app-debug.apk` on Android (enable install from unknown sources if required).

### If login fails on installed APK
1. Confirm `APP_WEB_URL` points to your real deployed app (not a placeholder or another project).
2. Ensure the deployed Cognito callback/logout URLs and `NEXT_PUBLIC_APP_URL` match that exact domain.
3. Ensure the deployed auth env vars are set (`APP_BACKEND_PROVIDER=aws`, Cognito vars, and `APP_SESSION_SECRET`).

## Notes / disclaimers
ACE NAIJA is **not** affiliated with WAEC, JAMB, IELTS, ACCA, or ICAN. Content is for preparation only.

## Security hardening implemented
- Strict security headers (CSP, HSTS in production, frame blocking, permissions policy, nosniff, COOP/CORP).
- Same-origin enforcement for state-changing requests in middleware and sensitive routes.
- Rate limiting on login, signup, email confirmation, session creation, avatar upload, billing init, and logout.
- Session cookies are `httpOnly`, `secure` (production), `sameSite=lax`, high priority, and 24-hour expiry.
- Avatar upload validates file type, max size, and binary signature before storing.

Important: no internet app is 100% hack-proof. Keep dependencies updated, rotate secrets, enforce strong backend access controls, and monitor logs/alerts continuously.
