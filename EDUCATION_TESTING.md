# Solaris Education Foundation Testing

## Required configuration

Set `DATABASE_URL` to the same PostgreSQL/Neon database used by the existing API. The first education API request creates its namespaced tables with `CREATE TABLE IF NOT EXISTS`; it does not alter existing registrations or visitor responses. Set a separate, random `AUTH_RATE_LIMIT_SECRET` in production so short-lived login throttle keys cannot be correlated if database credentials change.

## Automated checks

```sh
npm test
```

## Desktop manual test

1. Start with `npm run dev` and open `http://localhost:3000/spaceedu/teachers/account/`.
2. Confirm the page states that sign-in is optional and that `/explorer.html` remains directly accessible.
3. Register with a teacher email, school, and a password of at least 10 characters.
4. Refresh and confirm the secure session restores the account view.
5. Create a class and confirm a six-character class code appears.
6. Add a student display name, refresh, and confirm it remains in that class.
7. Sign out and confirm class/student endpoints return `401` without the session.
8. Sign back in and confirm the class and profile are still present.

## Mobile/throttled test

1. Use browser device emulation at 360 × 800 and Fast 3G throttling.
2. Repeat registration or sign-in, class creation, and student profile creation.
3. Confirm forms stack to one column, controls remain reachable, and status messages are announced/readable.
4. Open `/explorer.html` and confirm flat-screen exploration still starts when WebXR is unavailable.

## Missions manual test

1. Open `/explorer.html` and confirm the scene loads and the visitor can explore freely without any Learn prompt appearing automatically.
2. Click the new "Learn" corner icon (top-right, next to Help) and pick "Race Around the Sun".
3. Predict the fastest and slowest planet, continue through the simulate step (time speed jumps to 20×, orbits/labels turn on), the real-data table (labeled "Real data"), and the written-explanation step.
4. Confirm a score appears, then click "Finish" and confirm the camera/time-speed/orbit/label controls return to what they were before the mission started.
5. Repeat, and instead of Finish, click "Save to my class", enter a class join code from `/spaceedu/teachers/account/`, pick a student display name, and confirm the save succeeds.
6. Confirm free exploration (search, VR button, time slider, object selection) is unaffected by the mission overlay being open or closed.
7. Reopen Learn and try "The Scale Problem": confirm the real-data step shows a diameter/distance table (not orbital periods), and that a Jupiter-to-Earth estimate between 8–14 counts as correct.
8. Reopen Learn and try "Solar System Detective": confirm it opens directly on real clues (no prediction step first), that the guess step appears afterward, and that scoring matches whichever planet the clues described in that session.

## Results views manual test

1. On `/spaceedu/teachers/account/`, after creating a class and at least one student, click "View results" on the class card: confirm the panel lists every student ("No mission attempts yet." for new ones) without affecting other classes.
2. Save a mission attempt for a student (see Missions manual test step 5), then re-open "View results": confirm the attempt appears as `mission: score/max`.
3. Click "View results" again to collapse the panel, and once more to re-fetch — confirm it toggles and re-loads cleanly.
4. In `/explorer.html`, start any mission, click "Save to my class", pick a student, then click "View my past results": confirm the list shows only that student's attempts (or "No past results yet.").
5. Sign in as a different teacher and request the first teacher's class id via `/api/class-results?classId=<id>` (devtools/console): confirm a 404, not the roster.

## Deployment test (Vercel)

1. Confirm the Vercel project has `DATABASE_URL` (Neon connection string) and `AUTH_RATE_LIMIT_SECRET` set; functions return 500 without `DATABASE_URL`.
2. After deploy, hit `https://<deployment-url>/api/education/mission-attempts?studentId=not-a-uuid` and confirm a 400 JSON error (`A valid studentId is required.`) — this proves rewrites, the `[route]` dispatcher, and query-string survival all work in production.
3. Confirm `https://<deployment-url>/api/class-results` (no cookie) returns 401, and `/api/teacher-session` (no cookie) returns 401.
4. Confirm the static site still serves `/` and `/explorer.html` and the old direct function routes (`/api/register`, `/api/responses`, `/api/admin-login`, `/api/admin-responses`, `/api/space-chat`) still answer (405 for wrong method is expected — the point is they are not 404).

## Privacy

Stored personal data is limited to a teacher email, school, salted password hash, session token hash, class names, and teacher-entered student display names. Authentication throttling temporarily stores a non-reversible HMAC of the request scope, client address, and (for login) the attempted email, for up to 15 minutes; none of those raw values are stored. Student email is not requested. Student data is not sent to or shared with third parties by this feature.

Teacher email ownership is not yet verified, and self-service record deletion is not included in this foundation. Treat the feature as a limited pilot until verification/recovery and deletion controls ship.

Mission attempts store a mission id, the student's prediction/result/explanation text, and a score, linked to a class-scoped student profile (still no student email). Knowing a class's join code is sufficient to list that class's student display names and to read or submit mission attempts for any of them — an intentional trade-off recorded in `EDUCATION_ROADMAP.md`, appropriate for this pilot's low-stakes formative scoring.
