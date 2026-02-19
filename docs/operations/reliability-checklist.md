# Reliability Checklist (SLO)

## Core SLO targets
- Reminder delivery success (24h): >= 98%
- AI job completion success (24h): >= 95%
- Queue processing lag p95: <= 10 minutes
- API error rate p95 route group: <= 1%

## Daily checks
1. Open `/admin/ops` and verify `notifications failed` and `ai jobs failed` are near zero.
2. Confirm queued notifications are draining (not growing continuously).
3. Confirm queued AI jobs are processing and not stuck in `in_progress`.

## Cron schedule
- `/api/cron/reminders` every 1 minute
- `/api/cron/ai-jobs?limit=30` every 1 minute

Both must include `x-cron-secret` header matching `APP_CRON_SECRET`.

## Load smoke test
```bash
npm run load:smoke -- https://your-domain/api/health 400 40
```

Interpretation:
- `p95_ms` should remain stable over repeated runs.
- `failed` should be 0 for `/api/health`.
