# Solaris Education Roadmap

## Shipped

1. Data model & auth foundation — 2026-09-06
   - Optional teacher email/school accounts with database-backed sessions
   - Teacher-owned classes and class-scoped student display-name profiles (no student email)

## In progress

(empty)

## Next up

1. Mission framework + first 3 missions
2. Quizzes & scoring
3. Teacher dashboard v1
4. Challenge mode
5. What-if experiment framework
6. Worksheets & resources
7. Curriculum tagging
8. Progress & analytics

## Decisions log

- 2026-09-06 — Reused the existing PostgreSQL/Neon `pg` pool because it is already deployed and avoids a second persistence service.
- 2026-09-06 — Education tables initialize idempotently from the API because this static/Vercel repository has no migration runner.
- 2026-09-06 — Teacher sessions use hashed opaque tokens in HttpOnly, SameSite cookies; passwords use Node `scrypt`, avoiding new auth dependencies.
- 2026-09-06 — Auth throttling is PostgreSQL-backed across serverless instances and stores only short-lived HMAC keys, not raw network addresses.
- 2026-09-06 — Login throttle never resets on success, closing a bypass where a valid credential could be used to repeatedly clear the attempt budget.
- 2026-09-06 — Login uses a coarse per-address ceiling plus a tighter per-account limit (instead of one per-address bucket) so a shared school network isn't locked out by unrelated teachers' attempts.
- 2026-09-06 — The address ceiling short-circuits before the per-account limiter runs, so attacker-chosen emails can't keep inserting new limiter rows once that ceiling is hit.
- 2026-09-06 — Student profiles are class-scoped display names without email, minimizing data collection while supporting future mission progress.
- 2026-09-06 — Added the account UI as a self-contained route rather than editing the generated SpaceEdu bundle or the Solaris 3D runtime.
- 2026-09-06 — Public-pilot limitation: teacher emails are not yet verified; verification/recovery and teacher-controlled deletion are required before broad school rollout.
