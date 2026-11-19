# OnePlace — Phase 7 Launch Readiness & Pilot Expansion Report

**Platform**: OnePlace (`https://oneplace4all.netlify.app/`)  
**Repository**: `https://github.com/Sam18-prog/OnePlace`  
**Firebase Project**: `thermal-surface-rgt36` (AI Studio Starter Tier, Firestore DB `ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`)  
**Milestone**: Phase 7 — Product Launch, Real-World Adoption & Multi-School Onboarding

---

## 1. Executive Summary

Phase 7 transitions OnePlace from a hardened single-campus application into a pilot-ready, multi-school campus platform without weakening security rules, inventing synthetic adoption metrics, or forcing a paid Firebase Blaze upgrade.

Key additions delivered in Phase 7:
- **Rich School Profile & 10-Step Onboarding Workflow** inside **Organizer Studio → Launch** and **Settings**.
- **Controlled 4-Stage Pilot Program Tracker** (`Internal Validation` → `Student Trial` → `Club Expansion` → `School-Wide Release`) with explicit administrator confirmation before school status or pilot stage transitions.
- **Club Organizer Quick Start Checklist** (5 items, persisted in `/users/{uid}/onboarding/progress`, strictly informational and never granting permissions).
- **Optional, Non-Blocking 4-Step Student Campus Tour** launched only by student choice (hero strip or Profile), never blocking arrival on public feeds.
- **Controlled CSV Campus Data Import** for both **Clubs** and **Events** with template downloads, row-level validation, duplicate protection, and explicit admin confirmation.
- **Private Campus Feedback System** (`/schools/{schoolId}/feedback/{feedbackId}`) with student submission modal and admin triage inbox.
- **Public Product Landing Page** (`About OnePlace` / `?view=about`) backed by genuine live campus data and zero fabricated testimonials, partner logos, or adoption statistics.
- **Multi-School Hostname Resolution** (`VITE_SCHOOL_DOMAIN_MAP`) and allowlisted `?school=` preview support (`VITE_ALLOWED_QUERY_SCHOOLS`), plus complete operational documentation (`/README.md` and `/docs/*`).

---

## 2. Launch Readiness Gate Summary

| Area | Status | Evidence / Next Action |
| :--- | :--- | :--- |
| Authentication reliability | **Needs attention** | Verified-email checks and friendly Google OAuth error mapping active; verify every custom school domain is added in Firebase Authorized Domains prior to school rollout. |
| Firestore authorization & RBAC | **Ready** | Default-deny rules with school-scoped RBAC, suspended member blocking, and strict schema validation passed `npx eslint firestore.rules` (0 errors/warnings) and deployed live to `thermal-surface-rgt36`. |
| Multi-school tenant isolation | **Ready** | Clubs, events, memberships, feedback, and analytics partition by `schoolId`; bootstrap root admin is strictly scoped to `oakridge-high`. |
| RSVP data integrity & concurrency | **Ready** | Atomic attendee + counter writes, server timeout reconciliation, and past/cancelled guards verified via unit tests. |
| Event publishing & club permissions | **Needs attention** | Club-scoped organizer controls and CSV import are ready; target pilot school should register at least one active club and publish one real event before inviting students. |
| Student privacy & data minimization | **Ready** | Attendee and follower rosters disallow `list`; analytics/backup exports are PII-free; Support ID is collapsed behind explicit reveal; feedback is private to submitter + school admins. |
| Mobile usability & WCAG 2.2 AA | **Ready** | Verified `0px` horizontal overflow across `320px`, `390px`, `768px`, and `1440px` viewports, skip link, and focus-trapped modals with `Escape` dismissal. |
| Production deployment & security headers | **Needs attention** | `netlify.toml` configured with SPA redirects, HSTS, COOP (`same-origin-allow-popups`), and CSP; verify live HTTP headers on `oneplace4all.netlify.app` after Netlify deploy. |
| Error handling & diagnostics | **Ready** | Centralized friendly error mapping, PII-redacted diagnostics, and hardened `ErrorBoundary` active. |
| Data backup procedures | **Needs attention** | Manual PII-free JSON backup export active on Starter Tier; automated daily Firestore exports require upgrading to Blaze. |
| Administrative provisioning | **Ready** | Zero self-service role escalation; documented Firebase Console bootstrap for each new school's initial admin. |
| Firestore Emulator & live OAuth write test | **Not verified** | Container lacks Java JRE for Firestore Emulator; perform a live authenticated Stage 1 staff write test in a real browser before Stage 2 student rollout. |
| School profile activation status | **Needs attention** | Switch school status to `Active` in **Organizer Studio → Launch** only after Stage 1 internal validation completes. |

---

## 3. School Profile & 10-Step Onboarding Architecture

- **Schema Extension (`/schools/{schoolId}`)**: Added optional `logoUrl`, `coverImageUrl`, `description`, `location`, `contactEmail`, `contactName`, `pilotStage`, `onboardingChecklist` (6 explicit admin governance booleans), and expanded `status` (`active` | `pending_setup` | `suspended`).
- **Automated + Manual Progress**: `evaluateSchoolSetupSteps` (`src/utils/onboarding.ts`) auto-detects live Firestore state (timezone, branding, active clubs, assigned organizers, published events, active status) and combines it with persisted admin sign-off checkboxes (`profileReviewed`, `visibilityVerified`, `permissionsReviewed`, `privacyReviewed`, `notificationsReviewed`, `launchConfirmed`).
- **Status & Branding Integration**: `HeroSection` and `Footer` render configured school name, optional HTTPS logo, location, description, and honest status notices when a school is in `pending_setup` or `suspended` mode.

---

## 4. Controlled 4-Stage Pilot Rollout Workflow

Tracked inside **Organizer Studio → Launch** (`AdminLaunchPanel.tsx`):
1. **Stage 1 — Internal Validation**: School admins + 2–3 trusted organizers validate setup, publishing, editing, cancellation, and club-scoped permissions.
2. **Stage 2 — Student Trial**: 15–30 pilot students test mobile browsing, RSVPs, club following, and submit feedback via **Send Feedback**.
3. **Stage 3 — Club Expansion**: Import remaining active school clubs and onboard club officers.
4. **Stage 4 — School-Wide Release**: Open approved student access after confirming launch readiness and backup cadence.

Every school status or pilot stage change requires an explicit administrator confirmation step before writing to Firestore.

---

## 5. Club Organizer & Student Onboarding

- **Club Organizers (`OrganizerOnboardingCard.tsx`)**:
  - 5-step checklist combining live club/event state with persisted manual checks (`clubProfileReviewed`, `eventManagementReviewed`) stored under `/users/{uid}/onboarding/progress`.
  - Dismissible and reopenable from Organizer Settings. Explicitly states that onboarding progress never grants or modifies permissions.
- **Students (`StudentOnboardingModal.tsx`)**:
  - Strictly optional 4-step modal (Welcome → Optional Interests → Real Active Clubs → Real Published Events).
  - Never auto-opens on arrival (`hasArrivalModal: false` verified in Chromium); triggered via the dismissible `"Quick campus tour"` hero strip or **Profile → Open Campus Tour**.
  - Renders honest empty states when a campus has 0 clubs or 0 events—never fabricates sample organizations.

---

## 6. Controlled CSV Campus Data Import

Implemented in `src/utils/csvImport.ts` and `src/components/organizer/CsvImportPanel.tsx` (Admin-only under **Organizer Studio → Settings**):
- Supports both **Clubs CSV** and **Events CSV** with downloadable RFC-4180 templates, file upload (≤1 MB), and direct paste fallback.
- Performs row-level validation (required fields, character limits, canonical categories, HTTPS media URLs, valid dates/times, active club matching for events) and duplicate detection against both existing Firestore documents and intra-file duplicates.
- Events default to importing as `Draft` so administrators can inspect them before publishing.
- Never overwrites existing clubs/events and never auto-assigns organizer roles during club import.
- Requires explicit administrator confirmation checkbox before writing validated rows.

---

## 7. Private User Feedback & Admin Triage

- **Collection**: `/schools/{schoolId}/feedback/{feedbackId}`
- **Submission (`FeedbackModal.tsx`)**: Accessible via Footer (`Send Feedback`) and Profile. Requires verified Google sign-in, collects only feedback type, related area, and message (`10–1200` chars)—no extra student PII and no fabricated SLA promises.
- **Triage (`AdminFeedbackPanel.tsx`)**: School administrators filter by status (`new`, `reviewed`, `resolved`) or type, record optional internal notes, and update status. Students can never list or read other students' feedback.

---

## 8. Public Product Landing Page (`?view=about`)

Implemented as a lazy-loaded view (`ProductLandingPage.tsx`, `20.13 kB` raw / `4.10 kB` gzip) linked from the Footer (`About OnePlace`) and directly accessible via `?view=about`:
- Editorial hero (`"Your campus. Your community. Your next experience."`) paired with a **Live Campus Preview** displaying genuine active school data.
- Clear 3-audience breakdown (Students, Club Organizers, Schools), live implemented capabilities, privacy & multi-school security architecture, and 4-stage pilot rollout CTA.
- Zero fabricated testimonials, fake school logos, or invented student counts.

---

## 9. Multi-School Readiness & Routing

- **Runtime School Resolution (`src/utils/schoolContext.ts`)**:
  1. Hostname mapping via optional `VITE_SCHOOL_DOMAIN_MAP` JSON.
  2. Controlled `?school=<id>` preview only when explicitly allowlisted in `VITE_ALLOWED_QUERY_SCHOOLS` (arbitrary unallowlisted query overrides are blocked and unit-tested).
  3. Safe fallback to `VITE_SCHOOL_ID` (`oakridge-high`).
- **Isolation Safeguards**: Bootstrapped root admin access in both `firestore.rules` and `src/services/membershipService.ts` is strictly scoped to `oakridge-high`. New schools provision their first admin directly via Firebase Console per `docs/SCHOOL_ONBOARDING.md`.

---

## 10. Security Rules & Blueprint Updates

- Updated `firebase-blueprint.json` and `security_spec.md` (Sections 9–10, adversarial cases #28–#32).
- Updated and deployed `firestore.rules` with:
  - `isValidSchool`, `isValidOptionalUrl`, and `isValidSchoolOnboardingChecklist`
  - `isValidUserOnboardingProgress` and `/users/{uid}/onboarding/{docId}` (owner-only `'progress'` doc)
  - `isValidFeedbackSubmission` and `/schools/{schoolId}/feedback/{feedbackId}` (verified non-suspended create with `status == 'new'`, no public listing, admin-only status/note updates)
- Static security audit (`npx eslint firestore.rules`): **0 errors, 0 warnings**.
- Live rules deployment (`fax.DeployRules` RPC to `thermal-surface-rgt36`): **Succeeded**.

---

## 11. Starter Tier Compatibility & Upgrade Roadmap

- **Verified without `VITE_FIREBASE_VAPID_KEY`**: App builds, boots, and renders cleanly with `0` errors when VAPID key is omitted. Browser push registration stays gracefully disabled without prompting for notification permission.
- **Explicitly Disclosed Blaze-Only Features**:
  - Web Push via FCM + VAPID key + Cloud Functions fan-out.
  - Scheduled 24h / 1h automated reminder jobs via Cloud Scheduler.
  - Tamper-proof server-side audit logs and automated daily Firestore exports.

---

## 12. Operations & Support Documentation Delivered

- `/README.md` — Platform overview, architecture, Starter Tier vs. Blaze matrix, local verification commands.
- `/docs/SCHOOL_ONBOARDING.md` — New school provisioning, domain mapping, 10-step setup, 4-stage pilot.
- `/docs/ADMIN_GUIDE.md` — Roles, suspensions, school branding, CSV import, feedback triage, JSON backups.
- `/docs/ORGANIZER_GUIDE.md` — Support ID onboarding, Quick Start checklist, event lifecycle, privacy-first analytics.
- `/docs/STUDENT_GUIDE.md` — Discovery, RSVPs, club following, notifications, privacy, feedback.
- `/docs/INCIDENT_RESPONSE.md` — Severity levels and runbooks for OAuth, permissions, abusive content, quotas, and rollback.
- `/docs/RELEASE_CHECKLIST.md` — Pre-release code, rules, responsive, accessibility, and Netlify verification gates.

---

## 13. Runtime Verification Evidence

### Automated Unit Tests (`npx --yes tsx --test src/utils/*.test.ts`)
- **63 / 63 passing** (`0` failures), including new Phase 7 test suites:
  - `src/utils/csvImport.test.ts` (RFC-4180 parsing, event/club validation, duplicate skipping, missing/suspended club rejection, XSS URL rejection)
  - `src/utils/onboarding.test.ts` (10-step school workflow, 5-step organizer checklist, launch readiness gate honesty, hostname/query school context isolation)

### Static & Build Verification
- `npx eslint firestore.rules`: **0 errors, 0 warnings**
- `npm run lint` (`tsc --noEmit`): **0 errors**
- `npm run build` (`vite build`): **Succeeded in 1.30s, 0 warnings**
  - Main entry chunk (`index-*.js`): `237.70 kB` (`49.50 kB` gzip)
  - Lazy `ProductLandingPage-*.js`: `20.13 kB` (`4.10 kB` gzip)
  - Lazy `OrganizerDashboard-*.js`: `278.49 kB` (`49.06 kB` gzip)

### Real Chromium Browser Verification (`playwright-cli` against `http://localhost:3000`)
- **Discover (`1440x900`, `768x1024`, `320x640`)**: `0px` horizontal overflow, `hasArrivalModal: false`, live Firestore school profile rendered (`OnePlace Demo School`), `"Quick campus tour"` strip, `"About OnePlace"` & `"Send Feedback"` footer actions verified.
- **Student Onboarding Tour**: Opened cleanly, stepped `Step 1` → `Step 3`, focus trap active, dismissed cleanly via `Escape`.
- **Feedback Modal**: Opened via Footer, showed signed-out Google sign-in gate, dismissed cleanly via `Escape`.
- **Product Landing Page (`?view=about` at `1440x900`, `390x844`, `320x640`)**: `0px` horizontal overflow across all tested viewports, all 5 sections rendered cleanly, zero fabricated metrics.
- **Console / Page Errors**: `0` errors, `0` warnings.

---

## 14. Explicitly Unverified Items (Honest Disclosure)

The following items could **not** be executed inside the sandbox container and must be verified by the project owner during Stage 1 Internal Validation:
1. **Firestore Security Rules Emulator Tests**: Container lacks Java JRE (`java` unavailable), so adversarial rule payloads were verified statically (`eslint`) and deployed live, but not executed against the local Firestore Emulator.
2. **Live Authenticated OAuth Write Flows**: Interactive Google Sign-In popup flows (student RSVP write, club follow write, feedback submission, admin CSV import write, school status/pilot stage update) require a real Google session against `thermal-surface-rgt36`.
3. **Live Netlify Production Headers**: Verify `CSP`, `HSTS`, and `COOP` response headers directly against `https://oneplace4all.netlify.app/` after pushing to GitHub and completing Netlify deployment.

---

## 15. Recommended Immediate Launch Actions

1. Push the Phase 7 commits to `https://github.com/Sam18-prog/OnePlace` and verify Netlify builds cleanly without setting `VITE_FIREBASE_VAPID_KEY`.
2. Sign in as the School Administrator on `https://oneplace4all.netlify.app/`, open **Organizer Studio → Launch**, and complete Stage 1 Internal Validation with 1–2 trusted club organizers.
3. Import initial genuine school clubs (**Clubs CSV**) and draft events (**Events CSV**), verify organizer club-scoping, and export an initial JSON backup snapshot before advancing to Stage 2 Student Trial.
4. Review `firestore.rules` carefully before inviting broader student cohorts, and plan a Firebase Blaze upgrade once multi-school traffic, Web Push reminders, or automated daily backups are required.
