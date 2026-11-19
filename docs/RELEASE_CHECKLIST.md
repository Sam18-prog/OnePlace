# Production Release Checklist

Complete every applicable check before promoting a OnePlace build to production (`https://oneplace4all.netlify.app/`) or onboarding a new school.

---

## 1. Code Quality & Automated Tests

- [ ] Pure logic unit tests pass: `npx --yes tsx --test src/utils/*.test.ts`
- [ ] TypeScript typecheck passes with zero errors: `npm run lint`
- [ ] Production bundle builds cleanly with zero warnings: `npm run build`
- [ ] Verify initial entry chunk stays lean and secondary views (`OrganizerDashboard`, `ClubDiscoveryPage`, `ProductLandingPage`, etc.) remain code-split.
- [ ] Confirm no secrets, API private keys, or credentials exist in `.env.example` or `VITE_*` variables.

---

## 2. Firebase & Security Rules Verification

- [ ] `firebase-blueprint.json` matches all active collections, document fields, and validation limits.
- [ ] `firestore.rules` passes static security lint with 0 errors and 0 warnings: `npx eslint firestore.rules`
- [ ] Updated `firestore.rules` deployed to target Firebase project (`thermal-surface-rgt36`).
- [ ] Confirm `isBootstrappedAdmin(schoolId)` remains strictly scoped to `oakridge-high`.
- [ ] Confirm no temporary files (`DRAFT_firestore.rules`, `.playwright-cli/`) remain in the repository.
- [ ] *(When Java/Emulator or live test accounts are available)* Execute authenticated end-to-end verification of student RSVP, club follow, feedback submission, organizer club-scoped edit, and cross-school denial.

---

## 3. Starter Tier & Optional Feature Checks

- [ ] Confirm the app builds and boots cleanly when `VITE_FIREBASE_VAPID_KEY` is unset.
- [ ] Confirm browser notification permissions are never requested automatically on page load.
- [ ] Confirm no fabricated stats, fake schools, fake testimonials, or simulated push notifications appear anywhere in the UI.

---

## 4. Browser, Accessibility & Responsive Checks

- [ ] Verify 0px horizontal overflow at `320px`, `390px`, `768px`, and `1440px`.
- [ ] Verify zero uncaught console errors or page errors on Discover, Clubs, About OnePlace (`?view=about`), and modal dialogs.
- [ ] Verify keyboard focus trap and `Escape` dismissal on `EventDetailView`, `SignInPromptModal`, `StudentOnboardingModal`, and `FeedbackModal`.
- [ ] Confirm Student Onboarding tour does **not** auto-open as a blocking popup on arrival.

---

## 5. Deployment & Post-Release Checks (Netlify)

- [ ] Verify `netlify.toml` SPA fallback (`/* -> /index.html 200`) and security headers (`CSP`, `HSTS`, `COOP: same-origin-allow-popups`, `X-Content-Type-Options`, `Referrer-Policy`) on the live URL.
- [ ] Verify custom domains (if adding a school) are added to **Firebase Console → Authentication → Authorized domains**.
- [ ] Export a fresh PII-free JSON backup snapshot from **Organizer Studio → Settings** before major school launches.
