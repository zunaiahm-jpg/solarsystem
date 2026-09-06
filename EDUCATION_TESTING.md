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

## Privacy

Stored personal data is limited to a teacher email, school, salted password hash, session token hash, class names, and teacher-entered student display names. Authentication throttling temporarily stores a non-reversible HMAC of the request scope, client address, and (for login) the attempted email, for up to 15 minutes; none of those raw values are stored. Student email is not requested. Student data is not sent to or shared with third parties by this feature.

Teacher email ownership is not yet verified, and self-service record deletion is not included in this foundation. Treat the feature as a limited pilot until verification/recovery and deletion controls ship.
