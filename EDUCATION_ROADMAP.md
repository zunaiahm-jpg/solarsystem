# Solaris Education Roadmap

## Shipped

1. Data model & auth foundation — 2026-09-06
   - Optional teacher email/school accounts with database-backed sessions
   - Teacher-owned classes and class-scoped student display-name profiles (no student email)
2. Mission framework + first mission ("Race Around the Sun") — 2026-09-06
   - Generic, data-driven mission schema (`js/missions/schema.js`) and scoring aggregator (`js/missions/scoring.js`)
   - Predict → Simulate → Observe → Conclude → Score runner UI (`js/missions/runner.js`), opened from a new optional "Learn" corner button in `explorer.html`
   - Missions drive the existing engine only, via a DOM bridge (`js/missions/bridge.js`) that operates the same camera/time-speed/orbit/label controls a visitor could use by hand — no engine files were modified
   - Real/model/hypothetical labeling shown on every mission data step
   - Optional "save to my class" flow (join code → pick your name → save) plus always-on local browser history, so saving a result never requires an account

## In progress

(empty)

## Next up

1. Two more first-wave missions (The Scale Problem; Solar System Detective) on the same framework
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
- 2026-09-06 — Missions drive the existing engine purely through its own DOM controls (bridge.js dispatches the same input/change events a visitor triggers by hand) instead of adding new internal hooks to app.js/ui.js, keeping the engine files completely unmodified.
- 2026-09-06 — Mission attempts use the same join-code + opaque student-id trust model as the auth foundation: whoever learns a class's join code can list that class's display names and, using any listed student id, read or submit that student's mission attempts. This is an intentional, accepted trade-off for a no-student-email pilot (mission scores are low-stakes formative data, not grades) — revisit if the feature scales beyond a pilot.
- 2026-09-06 — join-class and mission-attempts rate limits are two-tier (generous per-address ceiling + tighter per-code/per-student bucket), mirroring the teacher-login fix, because shared school networks make many legitimate requests from one address.
- 2026-09-06 — Student profiles are class-scoped display names without email, minimizing data collection while supporting future mission progress.
- 2026-09-06 — Added the account UI as a self-contained route rather than editing the generated SpaceEdu bundle or the Solaris 3D runtime.
- 2026-09-06 — Public-pilot limitation: teacher emails are not yet verified; verification/recovery and teacher-controlled deletion are required before broad school rollout.
