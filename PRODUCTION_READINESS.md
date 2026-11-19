# OnePlace — Phase 6 Production Readiness & Security Audit Report

**Application**: OnePlace (Campus Event Discovery, Clubs, Notifications & Analytics Platform)  
**Firebase Project**: `thermal-surface-rgt36` (AI Studio Starter Tier — preserved intact)  
**Firestore Database**: `ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`  
**Live Deployment Target**: `https://oneplace4all.netlify.app/`  
**Repository**: `https://github.com/Sam18-prog/OnePlace`  
**Verification Legend**:
- **Passed** — Implemented and verified via automated tests, build/lint checks, deployed rules, or live headless Chromium testing.
- **Needs attention** — Implemented in code/config, with operational steps or external console settings required before full school rollout.
- **Not implemented** — Intentionally deferred because it requires Firebase Blaze / server-side infrastructure unavailable on Starter Tier.
- **Not verified** — Implemented and statically checked, but runtime execution could not be performed in this environment (explicitly noted below).

---

## 1. Security Audit Summary

| Severity | Finding | Location | Status | Resolution Applied |
|---|---|---|---|---|
| **Critical** | Bootstrapped admin fallback email was not scoped to a single `schoolId`, risking cross-school admin privileges once additional schools are onboarded. | `firestore.rules` (`isBootstrappedAdmin`) | **Passed** | Scoped `isBootstrappedAdmin(schoolId)` strictly to `schoolId == 'oakridge-high'`. Future schools must grant admin access explicitly via `schools/{schoolId}/members/{uid}`. |
| **High** | Cross-school admin mirror hijack: `/userMemberships/{uid}` and `/users/{uid}/managedClubs/{clubId}` used a combined `allow create, update` rule that checked `incoming().schoolId`, allowing an admin of School B to overwrite a School A user's mirror record. | `firestore.rules` | **Passed** | Split `allow create` vs `allow update`; updates now require `isSchoolAdmin(existing().schoolId) && incoming().schoolId == existing().schoolId`. |
| **High** | Suspended school members could still create new RSVPs (`+1`) or club follows (`+1`) on `visibility == 'public'` events/clubs because public visibility bypassed membership status checks. | `firestore.rules` (`isSuspendedSchoolMember`) | **Passed** | Added `isSuspendedSchoolMember(schoolId)` helper blocking suspended members from creating new RSVPs or new club follows, while still allowing them to cancel their own existing RSVP (`-1`) or unfollow (`-1`). |
| **High** | Raw serialized `FirestoreErrorInfo` JSON (containing Firestore paths, user UIDs, and provider metadata) was surfaced in error banners, toasts, and console warnings across hooks and organizer views. | `src/utils/errorHandling.ts`, `src/hooks/*`, `src/components/*` | **Passed** | Created centralized `toUserFriendlyErrorMessage`, `toFriendlyAuthError`, `sanitizeDiagnosticMessage`, and `logClientDiagnostic`. All UI error surfaces now display safe, plain-language copy; production diagnostics redact emails/UIDs/tokens. |
| **Medium** | `publicOrganizers` list on club documents only validated list size (`<= 25`), not individual map keys or field lengths. | `firestore.rules` (`isValidPublicOrganizerEntry`) | **Passed** | Added strict per-entry map key whitelist (`hasOnly(['uid', 'displayName', 'roleTitle'])`) and string length bounds on club create/update rules. |
| **Medium** | `allow read` on `/users/{uid}/followedClubs` and `/users/{uid}/managedClubs` applied `isValidId(clubId)` to `list` queries, and follow updates did not re-validate immutable metadata fields. | `firestore.rules` | **Passed** | Split `allow get` vs `allow list` (removing document-ID guard from `list`) and enforced `isValidUserFollowedClub` / `isValidClubFollower` + immutable `schoolId`/`clubId`/`userId`/`createdAt` on updates. |
| **Medium** | Raw Firebase UID was displayed openly by default on the student Profile page. | `src/components/ProfileView.tsx` | **Passed** | Moved Support ID behind a collapsed `"Need organizer access? Show account support ID"` disclosure and added a Student Privacy & Data Control card. |
| **Low** | Missing Netlify production security headers (`CSP`, `HSTS`, `X-Frame-Options`, `COOP`) and SPA fallback redirect rules in repository root. | `netlify.toml` | **Passed** | Added `/netlify.toml` with SPA `/* -> /index.html 200` redirect, immutable `/assets/*` caching, `no-cache` for `/index.html` & `/firebase-messaging-sw.js`, and Firebase-compatible security headers (`COOP: same-origin-allow-popups`). |
| **Informational** | Firebase App Check is not enforced on the Starter Tier project. | Firebase Console / `src/firebase.ts` | **Needs attention** | Documented optional reCAPTCHA Enterprise / App Check rollout in Section 3 without breaking Starter Tier compatibility. |
| **Informational** | Automated server-side scheduled backups, scheduled push reminders, and Cloud Functions are unavailable on AI Studio Starter Tier. | `thermal-surface-rgt36` | **Not implemented** | Documented Starter Tier boundaries in Section 15 and added a manual PII-free Admin JSON snapshot export in `AdminManagementPanel.tsx`. |

---

## 2. Firestore Security Rules Review & Hardening

- **Default-Deny Architecture**: Root catch-all `match /{document=**} { allow read, write: if false; }` remains enforced (`Passed`).
- **Multi-School Isolation**: Every operational write and private read validates `schoolId` against the target document and actor's `schools/{schoolId}/members/{uid}` record (`Passed`).
- **Role-Based Access Control (RBAC)**:
  - `student`: Can read public/school events & clubs, RSVP/cancel own RSVP, follow/unfollow clubs, read/manage own notifications & preferences. Cannot list other attendees, followers, or school members.
  - `club_organizer`: Scoped strictly to assigned `managedClubIds` (`isClubOrganizerFor`). Cannot edit unassigned clubs, cannot assign organizers, and cannot view school-wide admin panels.
  - `school_admin`: Scoped strictly to their own `schoolId`. Manages club approvals, organizer assignments, member roles/suspensions, and school-wide analytics.
- **RSVP & Follower Counter Integrity**: Transactional/batched writes enforce exact `+1` / `-1` increments paired with `existsAfter` / `!existsAfter` checks on the attendee/follower subcollection document (`Passed`).
- **Static Rules Linting**: `npx eslint firestore.rules` completed with **0 errors, 0 warnings** (`Passed`).
- **Live Rules Deployment**: Deployed `firestore.rules` to `thermal-surface-rgt36` via `DeployRules` RPC (`Passed`).
- **Firestore Emulator Execution Tests**: **Not verified** — while `firebase` CLI is present in the container, no Java JRE (`java`) is installed locally to run the Firestore Emulator. We recommend running `firebase emulators:exec --only firestore` locally on a workstation with Java 17+ and reviewing `firestore.rules` and `security_spec.md` before full campus rollout.

---

## 3. Authentication & Account Security

| Check | Status | Details |
|---|---|---|
| Google Sign-In popup cancellation & popup-blocked UX | **Passed** | `src/hooks/useAuth.ts` maps `auth/popup-closed-by-user`, `auth/cancelled-popup-request`, `auth/popup-blocked`, `auth/network-request-failed`, `auth/too-many-requests`, and `auth/unauthorized-domain` via `toFriendlyAuthError` (`src/utils/errorHandling.ts`). Includes double-click sign-in guard (`signingInRef`). |
| Verified email enforcement | **Passed** | `firestore.rules` requires `request.auth.token.email_verified == true` for authenticated writes. `ProfileView.tsx` now reflects actual `user.emailVerified` status instead of hardcoding `"Verified"`. |
| Private view loading gates | **Passed** | `src/App.tsx` gates `my-rsvps`, `notifications`, `notification-preferences`, `profile`, and `organizer` behind an auth/membership loading state so unauthenticated flashes never occur during session hydration. |
| Suspended account UX & enforcement | **Passed** | Suspended members see a clear `role="alert"` banner in `App.tsx` and are blocked at the Firestore rules layer from new RSVPs/follows and organizer actions. |
| Firebase Auth Authorized Domains | **Needs attention** | Before launching on any custom school domain, verify `oneplace4all.netlify.app` and the custom domain are listed in Firebase Console → Authentication → Settings → Authorized domains. |
| Firebase App Check | **Not implemented** | Optional on Starter Tier. To enable later, register a reCAPTCHA Enterprise site key in Firebase Console → App Check and initialize `initializeAppCheck(app, ...)` inside `src/firebase.ts` guarded by `VITE_FIREBASE_APPCHECK_SITE_KEY`. |

---

## 4. Student Data Privacy & Protection

| Control | Status | Evidence |
|---|---|---|
| No attendee or follower list enumeration | **Passed** | `firestore.rules` denies `list` on `/events/{eventId}/attendees` and `/clubs/{clubId}/followers` for all clients (including organizers and admins). Only aggregated `rsvpCount` and `followerCount` counters are exposed. |
| Data minimization on RSVP & follow records | **Passed** | Student RSVP/follow docs store only `userId`, `schoolId`, `createdAt` (and `notificationsEnabled` for follows) — no student email, phone number, grade, or home address. |
| PII-free analytics, CSV, and backup exports | **Passed** | `src/utils/analytics.ts` and `src/utils/backupExport.ts` operate strictly on aggregate counts and strip `createdBy`, organizer `uid`s, attendee records, follower records, and member emails. Verified by `src/utils/backupExport.test.ts`. |
| Collapsed Account Support ID | **Passed** | `src/components/ProfileView.tsx` hides the Firebase UID inside a collapsed disclosure by default. |
| Zero raw error/path leakage | **Passed** | Verified by `src/utils/errorHandling.test.ts` — JSON `FirestoreErrorInfo`, raw emails, and long UIDs are never rendered to end users. |
| Student account deletion & data retention | **Needs attention** | Students can revoke RSVPs, unfollow clubs, and disable notifications self-service today. Full automated account purge (deleting `/users/{uid}/**`, `/userMemberships/{uid}`, and decrementing counters atomically) requires a Blaze Cloud Function (`onUserDelete` / callable `deleteMyAccount`) and a school data-retention policy before broad district rollout. |

---

## 5. Performance & Bundle Analysis

### Production Vite Build Comparison (`npm run build`, Vite 8.3.8 / Rolldown)

| Metric | Pre-Phase 6 Baseline | Post-Phase 6 Optimized | Delta |
|---|---|---|---|
| Main App Entry Chunk (`index-*.js`) | `1,667.88 kB` (`441.67 kB` gzip) | `202.91 kB` (`42.61 kB` gzip) | **-87.8% raw / -90.4% gzip** |
| Largest Single Chunk | `1,667.88 kB` (monolith warning) | `496.75 kB` (`vendor-firebase-firestore`, `149.84 kB` gzip) | **0 Vite >500 kB chunk warnings** |
| Organizer Studio Chunk (`OrganizerDashboard-*.js`) | Bundled eagerly for all students | `208.03 kB` (`35.92 kB` gzip) — lazy-loaded | **0 kB downloaded by students** |
| Secondary Views (`Clubs`, `ClubProfile`, `Profile`, `Notifications`, `Preferences`, `MyEvents`) | Bundled eagerly | `11.60 kB` – `31.13 kB` each (`2.22 kB` – `5.91 kB` gzip) | **Loaded on demand via `React.lazy`** |
| Vendor Cache Splits | None | `vendor-firebase-firestore` (`496.75 kB`), `vendor-react` (`431.25 kB`), `vendor-motion` (`127.61 kB`), `vendor-firebase-core` (`98.58 kB`), `vendor-icons` (`16.20 kB`) | **Long-term immutable browser caching** |
| Unused External Import Map (`index.html`) | Present | Removed | **Eliminated unused CDN config** |
| Vite Config Deprecation Warning (`__dirname`) | Present | Replaced with `import.meta.dirname` | **0 build warnings** |

### Firestore Read-Cost Profile
- Public Discover/Clubs feeds use bounded `limit()` queries scoped by `discoverKey` / `schoolId` with real-time `onSnapshot` listeners attached only while mounted.
- Secondary collections (notifications, managed clubs, organizer analytics data) are scoped to the authenticated user or active school.
- **Scaling note**: Once a school exceeds ~500 active events per semester, introduce cursor pagination (`startAfter`) on Explore Events and server-aggregated analytics snapshots (Blaze Cloud Functions) to keep per-session reads low.

---

## 6. RSVP Reliability & Concurrency

| Capability | Status | Implementation |
|---|---|---|
| Atomic attendee + counter write | **Passed** | `src/services/rsvpService.ts` writes `/events/{id}/attendees/{uid}`, `/users/{uid}/rsvps/{id}`, and `rsvpCount` increment atomically in a single Firestore batch/transaction. |
| Authoritative server reconciliation after timeout | **Passed** | When an RSVP write exceeds `RSVP_TIMEOUT_MS` (5s) or hits a transient network drop (`isUncertainRsvpWriteError`), `src/hooks/useEvents.ts` calls `reconcileEventRsvp` using `getDocFromServer` (with retry) before displaying an error toast. If the slow write actually committed on the server, the UI confirms success instead of falsely rolling back. |
| Past, draft & cancelled event guard | **Passed** | `canToggleEventRsvp` (`src/utils/rsvp.ts`) blocks new RSVPs on past, draft, and cancelled events while still allowing existing attendees to cancel their RSVP on a cancelled event. |
| Duplicate click prevention | **Passed** | Per-event `pendingRsvpIds` lock prevents concurrent double-submits. |
| Cross-tab RSVP synchronization | **Passed** | `BroadcastChannel('oneplace-rsvp-sync')` in `src/hooks/useEvents.ts` synchronizes optimistic/confirmed RSVP state immediately across open browser tabs. |
| Unit test coverage | **Passed** | 8 dedicated unit tests in `src/utils/rsvp.test.ts` covering optimistic math, timeouts, past/draft/cancelled guards, error classification, and reconciliation outcomes. |

---

## 7. Event & Club Data Integrity

- **Club-to-School Binding**: `firestore.rules` verifies on event create/update that `clubId` exists in `/clubs/{clubId}`, belongs to the same `schoolId`, and is `status == 'active'` before allowing publication (`Passed`).
- **Suspended Club Guard**: Organizers cannot publish events under a suspended club (`Passed`).
- **Validation**: `src/utils/eventValidation.ts` and `src/utils/clubValidation.ts` enforce title/description bounds, valid date ordering (`endAt > startAt`), and safe HTTPS image URLs (rejecting `javascript:` / `data:` URLs) (`Passed`).
- **Existing Records**: Zero automatic schema migrations were executed against live Firestore documents (`Passed`).

---

## 8. Error Monitoring, Boundary & Diagnostics

- **Centralized Error Layer (`src/utils/errorHandling.ts`)**: Normalizes Firebase Auth errors, Firestore permission/timeout/unavailable errors, and generic JS errors into user-safe messages (`Passed`, verified by `src/utils/errorHandling.test.ts`).
- **React Error Boundary (`src/components/ErrorBoundary.tsx`)**: Hardened with `role="alert"`, PII-safe diagnostic logging (`logClientDiagnostic`), friendly fallback copy, and both **Try Again** and **Reload Page** actions (`Passed`).
- **Production Diagnostic Redaction**: `sanitizeDiagnosticMessage` redacts email addresses, long Firebase UIDs, and Bearer tokens before writing client diagnostics in production (`Passed`).
- **External Telemetry (Sentry / Cloud Error Reporting)**: **Not implemented** on Starter Tier; `logClientDiagnostic` provides a single integration hook where Sentry (`Sentry.captureException`) can be attached with zero component changes when ready.

---

## 9. Accessibility Audit (WCAG 2.2 AA)

| Criterion | Status | Verification |
|---|---|---|
| Skip to main content link | **Passed** | Added keyboard-focusable `"Skip to main content"` link targeting `<main id="main-content" tabIndex={-1}>` in `src/App.tsx`; verified in DOM across all 7 viewports. |
| Reusable focus trap on all dialogs | **Passed** | Created `src/hooks/useFocusTrap.ts` (Tab / Shift+Tab wrap, Escape close, body scroll lock, focus restoration) and integrated into `EventDetailView`, `SignInPromptModal`, `EventForm`, `CancelEventModal`, and both modals in `ClubManagementView`. Live Chromium verified `focusTrapped: true` and `dialogClosedOnEsc: true` on `SignInPromptModal`. |
| Accessible error announcements | **Passed** | Added `role="alert"` / `aria-live="assertive"` on inline auth/form errors, suspended member banner, and ErrorBoundary fallback. |
| Landmarks & semantic headings | **Passed** | Verified `<header>`, `<nav aria-label="Primary navigation">`, `<main id="main-content">`, `<footer>`, and single `<h1>` per active view. |
| Screen-reader manual audit (NVDA/VoiceOver) | **Not verified** | Automated DOM/keyboard checks passed in headless Chromium; a quick manual VoiceOver/NVDA walkthrough is recommended before district accessibility sign-off. |

---

## 10. Mobile & Responsive Verification

Verified in headless Chromium (`playwright-cli`) against the live dev server across all 7 target breakpoints after fixing a `21px` tablet overflow at `768px` in `src/components/Header.tsx`:

| Viewport | `innerWidth` | `scrollWidth` | Horizontal Overflow | Skip Link & `<main>` | Result |
|---|---:|---:|---:|---|---|
| `320 × 640` (Compact mobile) | `320px` | `320px` | `0px` | Present | **Passed** |
| `360 × 780` (Android mobile) | `360px` | `360px` | `0px` | Present | **Passed** |
| `390 × 844` (iPhone 14/15) | `390px` | `390px` | `0px` | Present | **Passed** |
| `430 × 932` (Large mobile) | `430px` | `430px` | `0px` | Present | **Passed** |
| `768 × 1024` (Tablet portrait) | `768px` | `768px` | `0px` | Present | **Passed** |
| `1024 × 768` (Small desktop) | `1024px` | `1024px` | `0px` | Present | **Passed** |
| `1440 × 900` (Desktop) | `1440px` | `1440px` | `0px` | Present | **Passed** |

- **Console & Runtime Health**: `0` console errors, `0` console warnings, `0` uncaught `pageerror` exceptions across initial load, viewport resizes, modal interactions, and lazy route transitions (`Discover`, `Explore Events`, `Clubs`, `My Events`, `Notifications`).

---

## 11. Netlify Deployment Hardening

Added `/netlify.toml` configured specifically for OnePlace + Firebase Auth/Firestore:
- **SPA Routing**: `/* -> /index.html` (`200`) prevents 404s on deep links (`Passed`).
- **Cache Control**:
  - `/assets/*`: `public, max-age=31536000, immutable`
  - `/index.html` and `/firebase-messaging-sw.js`: `no-cache, no-store, must-revalidate`
- **Security Headers**:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups` (preserves Firebase Google OAuth popup flow)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
  - `Content-Security-Policy` scoped to `'self'`, Google/Firebase Auth & Firestore endpoints, Google Fonts, and HTTPS images (`Passed` in config; **Needs attention**: verify zero CSP violations on the live `oneplace4all.netlify.app` deploy after pushing to GitHub/Netlify).

---

## 12. Backup, Recovery & Data Retention Strategy

- **Starter Tier Operational Snapshot (`Passed`)**: School admins can export a school-isolated, PII-free JSON backup (`clubs` + `events` metadata & aggregate counts) directly from **Organizer Studio → Admin → Operational Backup Snapshot** (`src/utils/backupExport.ts`, `src/components/organizer/AdminManagementPanel.tsx`).
- **Limitations on Starter Tier (`Not implemented`)**: Automated daily Firestore exports to Cloud Storage (`gcloud firestore export`) and Point-in-Time Recovery (PITR) require upgrading the Google Cloud / Firebase project to the Blaze plan.
- **Recommended School Cadence**: Export a monthly JSON snapshot before major semester transitions (fall club fair, winter break, graduation) and store it in an administrator-controlled Google Drive folder.

---

## 13. Multi-School Scalability & Second-School Onboarding Guide

OnePlace's Firestore schema and security rules are natively partitioned by `schoolId` (`schools/{schoolId}/members/{uid}`, `discoverKey: "public:{schoolId}"`). With Phase 6 scoping `isBootstrappedAdmin` strictly to `oakridge-high`, onboarding a second school (e.g., `westview-high`) requires zero code changes:

1. **Create the school config document** in Firestore: `/schools/westview-high` with `{ name, timezone, allowPublicDiscovery, active: true }`.
2. **Assign the initial School Admin**: Create `/schools/westview-high/members/{adminUid}` with `{ uid, schoolId: "westview-high", role: "school_admin", status: "active", managedClubIds: [], ... }` and mirror `/userMemberships/{adminUid}` with `{ uid, schoolId: "westview-high", role: "school_admin", status: "active" }`.
3. **Configure deployment env vars** for the second school's Netlify site (or future host-based routing):
   - `VITE_SCHOOL_ID=westview-high`
   - `VITE_SCHOOL_NAME="Westview High School"`
   - `VITE_SCHOOL_TIMEZONE=America/Los_Angeles`
4. **Add the new domain** to Firebase Console → Authentication → Authorized Domains.
5. **Confirm isolation**: Westview admins can only manage `westview-high` clubs, events, and members; Oakridge High data remains completely isolated by Firestore rules.

---

## 14. Verification & Test Matrix

| Verification Check | Result | Details |
|---|---|---|
| Unit Tests (`npx tsx --test src/utils/*.test.ts`) | **Passed** | **55 / 55 tests passing** across 10 test suites (`analytics`, `backupExport`, `clubValidation`, `errorHandling`, `events`, `eventValidation`, `notificationValidation`, `personalization`, `rsvp`, `starterNotifications`). |
| TypeScript Check (`npm run lint` / `tsc --noEmit`) | **Passed** | 0 type errors. |
| Production Build (`npm run build`) | **Passed** | Built in `~1.0s`, 0 warnings, all chunks `< 500 kB`. |
| Firestore Rules ESLint (`npx eslint firestore.rules`) | **Passed** | 0 errors, 0 warnings. |
| Live Firestore Rules Deployment (`DeployRules` RPC) | **Passed** | Deployed cleanly to `thermal-surface-rgt36`. |
| Real Browser Multi-Viewport & A11y (`playwright-cli`) | **Passed** | 7/7 viewports at `0px` horizontal overflow, 0 console/page errors, modal focus trap + Escape verified, lazy routes verified. |
| Firestore Rules Emulator Suite | **Not verified** | Container lacks a Java runtime (`java`) for the local Firebase Firestore Emulator. |
| Live Authenticated Google OAuth Write Flow | **Not verified** | Interactive Google OAuth sign-in cannot be automated in headless sandbox; verify manually on `oneplace4all.netlify.app` (RSVP toggle, club follow, event publish, admin backup download). |
| Live Netlify CSP & Header Verification | **Not verified** | Must be verified via browser DevTools Network tab once `netlify.toml` is deployed to `oneplace4all.netlify.app`. |

---

## 15. Starter Tier vs. Blaze Upgrade Roadmap

| Feature | Starter Tier (`thermal-surface-rgt36` Today) | Requires Blaze Plan |
|---|---|---|
| Google Sign-In & Role-Based Access Control | **Supported** | — |
| Public & School-Only Event/Club Discovery | **Supported** | — |
| Atomic RSVPs with Timeout Reconciliation & Cross-Tab Sync | **Supported** | — |
| Club Discovery, Profiles, Following & Organizer Studio | **Supported** | — |
| In-App Notification Center & Firestore Preferences | **Supported** | — |
| Client-Computed Organizer & School Analytics + CSV Export | **Supported** | — |
| Manual PII-Free Admin JSON Backup Snapshot | **Supported** | — |
| Scheduled 24h / 1h Background Push Reminders | Graceful disabled state (no VAPID required) | Cloud Functions + Cloud Scheduler + FCM VAPID |
| Server-Side Fan-Out Push Notifications | Graceful disabled state | Cloud Functions + FCM Admin SDK |
| Automated Daily Firestore Backups & PITR | Manual JSON snapshot only | Blaze + Cloud Storage Bucket / PITR |
| Automated Full Account Purge (`onUserDelete`) | Manual self-service opt-out | Cloud Functions (Admin SDK) |
| Server-Aggregated Analytics Rollups (>500 events/term) | Client aggregation over bounded queries | Scheduled Cloud Functions |
| Enforced Firebase App Check | Optional client hook ready | Firebase App Check + reCAPTCHA Enterprise |
