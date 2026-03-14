# AWS Backend Guide

This document tracks the AWS-native backend layout for ACE NAIJA and the deployment steps needed to keep the existing learner, admin, syllabus, quiz, billing, and support flows intact.

## Runtime architecture

- Hosting: AWS Amplify Hosting for Next.js
- Auth: Amazon Cognito User Pool with email verification and Google sign-in
- Data: Aurora PostgreSQL Serverless v2 through the RDS Data API
- Storage: Amazon S3 with app-served object proxy URLs
- Background work: EventBridge plus Lambda
- Secrets and env: Amplify environment variables, AWS Secrets Manager, and stack export helpers

## Preserved product rules

- Signup requires email verification before app access
- New users receive 3 days of full trial access
- Pro access lasts 30 rolling days from activation time
- After trial expiry, users can still access history, tests, and mock exam
- Admin authorization continues through `profiles.role`

## Core app surfaces now backed by AWS

- Cognito sessions, password auth, signup confirmation, Google OAuth, and logout
- Aurora-backed app data client in `src/lib/backend/data-client.ts`
- Aurora-backed distributed rate limiting in `src/lib/security/rate-limit.ts`
- S3-backed uploads and reads in `src/lib/backend/storage.ts`
- Amplify env generation and validation in `scripts/amplify-write-env.mjs` and `scripts/validate-aws-env.mjs`
- CloudFormation foundation stack in `infra/aws/cloudformation/backend-foundation.yaml`
- Aurora schema in `infra/aws/aurora/schema.sql`

## Data inventory

- `app_settings`
- `profiles`
- `profile_public`
- `exams`
- `syllabi`
- `user_exam_subjects`
- `user_plans`
- `plan_items`
- `groups`
- `group_members`
- `group_messages`
- `tutor_threads`
- `tutor_messages`
- `contact_requests`
- `quizzes`
- `quiz_questions`
- `user_quiz_results`
- `notifications`
- `notification_prefs`
- `subscriptions`
- `badges`
- `user_gamification`
- `user_xp_events`
- `leaderboard_entries`
- `success_stories`
- `referral_codes`
- `referrals`
- `parent_links`
- `auth_sessions`
- `billing_events`
- `ai_jobs`
- `study_assets_cache`
- `rate_limits`

## Provisioning flow

1. Deploy `infra/aws/cloudformation/backend-foundation.yaml`.
2. Run `npm run aws:stack:export-env -- --stack-name <stack> --region <region> --out .env.aws`.
3. Add the exported values to Amplify environment variables.
4. Run `npm run aws:schema:apply -- --region <region> --cluster-arn <arn> --secret-arn <arn> --database <db>`.
5. Redeploy Amplify so the generated `.env.production` picks up Cognito, Aurora, and S3 values.

## Required Amplify env

- `APP_BACKEND_PROVIDER=aws`
- `NEXT_PUBLIC_APP_URL`
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

## Auto-derived deploy values

Amplify build helpers now derive these when enough base env is present:

- `APP_WEB_URL`
- `COGNITO_CALLBACK_URL`
- `COGNITO_LOGOUT_URL`
- `PAYSTACK_CALLBACK_URL`
- `S3_PUBLIC_BASE_URL`

## Verification checklist

1. `GET /api/health` returns `backendProvider: "aws"` and AWS backend readiness.
2. Signup sends the Cognito email confirmation flow and blocks access until verified.
3. Login, logout, Google sign-in, admin pages, and session tracking work.
4. Avatar upload, branding upload, and syllabus document upload read and write through S3.
5. Onboarding, syllabus generation, plan generation, quizzes, billing, referrals, support, and parent links read and write through Aurora.
