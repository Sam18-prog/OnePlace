# OnePlace — Phase 8 Event Operations Report

**Project**: OnePlace (`thermal-surface-rgt36`, Firestore database `ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`)  
**Scope**: Advanced Event Operations, Registration & Capacity Controls, FIFO Waitlists, Starter-Tier-Safe Check-In & Attendance Management, Event Announcements, Student Event Preparation, and Post-Event Feedback.

---

## 1. Existing Repository Verification (Pre-Implementation Audit)

Before implementing Phase 8, the codebase was audited directly:
- **Verified Present (Phases 1–7)**: Editorial discovery feed (`Discover`, `Explore`, `Clubs`, `My Events`, `Notifications`, `Profile`, `About`, `Organizer Studio`), Google Auth + school memberships (`schools/{schoolId}/members/{uid}`), managed events (`events/{eventId}`), legacy RSVPs (`events/{eventId}/attendees/{uid}` + `rsvpCount`), clubs & follows, Starter-Tier-safe in-app notification center (without mandatory `VITE_FIREBASE_VAPID_KEY`), Organizer Analytics, Security Hardening, and Launch/Onboarding workflows.
- **Confirmed Absent Prior to Phase 8**: Capacity limits, registration open/close windows, approval workflows, FIFO waitlists, event check-in & attendance tracking, event-specific organizer announcements, student preparation cards, and post-event feedback collection.
- **Infrastructure Tier Confirmed**: `thermal-surface-rgt36` runs on Firebase AI Studio Starter Tier (Authentication + Cloud Firestore active; Cloud Functions, Cloud Scheduler, Admin SDK signing, KMS, and local JRE Firestore Emulator are not provisioned).

---

## 2. Phase 8 Data Model & Backward Compatibility

All Phase 8 additions extend `events/{eventId}` with optional fields and subcollections so Phase 1–7 records continue functioning without migration:

### Extended `events/{eventId}` Optional Fields
- `capacityLimit?: number | null` (integer `1..100000` or `null` for unlimited)
- `registrationOpensAt?: Timestamp | null`
- `registrationClosesAt?: Timestamp | null`
- `allowWaitlist?: boolean`
- `requireApproval?: boolean`
- `registrationStatus?: 'open' | 'full' | 'closed' | 'cancelled'`
- `confirmedCount?: number` (synchronized atomically with canonical `rsvpCount`)
- `pendingApprovalCount?: number`
- `waitlistCount?: number`
- `checkedInCount?: number`
- `cancelledCount?: number`
- `feedbackCount?: number`
- `feedbackRatingSum?: number`
- `latestAnnouncementAt?: Timestamp`

### New Subcollections
1. `events/{eventId}/registrations/{uid}` — Authoritative student registration record (`confirmed | pending_approval | waitlisted | cancelled`, server `registeredAt`, server `waitlistTimestamp`, optional `offerExpiresAt`, `approvedBy`, `approvedAt`, `promotedAt`, `cancelledAt`).
2. `events/{eventId}/attendance/{uid}` — Organizer-controlled attendance record (`not_checked_in | checked_in | excused`, `method: 'manual' | 'qr_token'`, `checkedInAt`, `checkedInBy`, `correctionNote`).
3. `events/{eventId}/announcements/{announcementId}` — Event-specific organizer updates (`title`, `message`, `status: 'active' | 'archived'`, `createdBy`, `createdAt`, `updatedAt`).
4. `events/{eventId}/feedback/{uid}` — One feedback document per eligible participant UID (`overallRating: 1..5`, `organizationRating: 1..5`, optional `writtenFeedback`, optional `improvementSuggestions`).

### Legacy RSVP Compatibility
- `resolveStudentEventLifecycleState()` merges `attendance` > `registrations/{uid}` > legacy `attendees/{uid}` into a single unambiguous student status (`not_registered | confirmed | pending_approval | waitlisted | cancelled | attended`).
- Legacy `attendees/{uid}` cancellations route through the existing legacy RSVP deletion transaction, while all new registrations create Phase 8 `registrations/{uid}` documents and keep `rsvpCount` and `confirmedCount` locked together.

---

## 3. Registration, Capacity Enforcement & Waitlist Architecture

- **Atomic Transactions**: `registerStudentForEvent`, `cancelStudentRegistration`, `organizerApproveOrPromoteRegistration`, and `organizerCancelRegistration` execute inside `runTransaction()` in Firestore, reading both the parent event document and the student's registration/legacy-attendee documents before writing.
- **Server-Side Rule Enforcement**: `firestore.rules` validates:
  - Capacity cannot be exceeded (`hasCapacityForOneMore(eventId)` on both Phase 8 `registrations/{uid}` and legacy `attendees/{uid}`).
  - Registration open/close windows (`isRegistrationWindowOpen(eventId)`) and `registrationStatus != 'closed'`.
  - Duplicate prevention (blocks writing `registrations/{uid}` when legacy `attendees/{uid}` exists, and vice versa).
  - Waitlist queue fairness (`waitlistTimestamp == request.time` on creation/re-waitlisting so clients cannot backdate queue timestamps).
  - Parent counter integrity (`rsvpCount`, `confirmedCount`, `pendingApprovalCount`, `waitlistCount`, `cancelledCount`) checked via `getAfter()` in `firestore.rules`.
- **FIFO Waitlist Operations**: `sortWaitlistQueue()` orders strictly by `waitlistTimestamp` ascending with `registeredAt` and `uid` tie-breakers. Organizers can promote the next eligible candidate (`selectNextWaitlistPromotionCandidate()`, skipping expired offers), promote a specific waitlisted student, or set a 24-hour offer expiry window.

---

## 4. QR Check-In Security Posture & Attendance Management

- **No Insecure Client-Only QR Codes**: OnePlace intentionally **does not** generate or scan predictable client-side QR codes (such as `eventId:uid` or unsigned JSON payloads), which are trivially spoofable.
- **Blaze-Ready Signed Token Verification Engine**: `validateQrCheckInAttempt()` implements and unit-tests the full server-token verification state machine (unauthorized scanner, missing/invalid signature, revoked token, expired token, wrong event, wrong school, cancelled event, duplicate scan, unregistered student, already checked in, and valid pass).
- **Starter-Tier Active Check-In Workflow**: Authorized club organizers and school administrators use the mobile-friendly **Check-In & Attendance** workspace inside Organizer Studio (`Operations` tab) with:
  - Live aggregate KPIs: Confirmed, Checked In, Not Checked In, Cancelled, and Attendance Rate (`checkedIn / confirmed`, or `—` when `confirmed == 0`).
  - Large 46px+ touch-target one-tap **Check In** controls with instant attendee search and status filters.
  - Duplicate check-in prevention (both in `evaluateOrganizerCheckInAction` and inside `organizerSetAttendanceStatus` transaction).
  - Authorized attendance correction / undo drawer with optional audit notes (`not_checked_in` or `excused`), enforced exclusively for active event organizers and school admins in `firestore.rules`.

---

## 5. Event Announcements & Student Preparation Experience

- **Organizer Publishing**: Authorized organizers/admins publish and archive active announcements in `events/{eventId}/announcements/{announcementId}` from `Operations -> Announcements`.
- **Student Surfaces**:
  - **Event Detail View**: Displays live capacity progress bar, registration open/close windows, unambiguous status callout, check-in readiness notice, active organizer announcements, and post-event feedback after `event.endAt`.
  - **My Events Preparation View**: Displays dedicated preparation cards for upcoming confirmed, pending, waitlisted, and attended events with school-timezone date/time, venue, latest organizer announcement preview, Google Calendar export, check-in readiness status, cancellation actions where permitted, and **Share Post-Event Feedback** cues on past events.
  - **Starter Tier In-App Notifications**: `deriveStarterTierNotifications()` integrates active Phase 8 event announcements for registered/waitlisted events into the existing Phase 4 notification center without requiring FCM/VAPID or Cloud Functions.

---

## 6. Post-Event Feedback & Privacy Guarantees

- **Strict Eligibility**: `evaluatePostEventFeedbackEligibility()` and `firestore.rules` enforce that feedback can ONLY be submitted:
  - After `event.endAt` (`request.time >= event.endAt`).
  - By verified, non-suspended participants who are confirmed registrants, legacy attendees, or checked-in attendees.
  - Once per student per event (document ID = `uid`, immutable after creation).
- **Privacy & Anonymization**:
  - Students can read only their own feedback document; cross-student feedback reads are blocked in `firestore.rules`.
  - Organizer summaries pipe records through `aggregateEventFeedbackSummary()`, stripping `submittedBy` UIDs so individual student identities are never exposed in organizer feedback views.
  - No fake AI sentiment analysis or fabricated summary text is generated.

---

## 7. Security Rules Audit & Live Deployment

- Updated `/firebase-blueprint.json` and `/security_spec.md` (Sections 11 & 12, covering adversarial payloads #33–39).
- Updated `/firestore.rules` and verified with `npx eslint firestore.rules`: **0 errors, 0 warnings**.
- Deployed updated `firestore.rules` live to `thermal-surface-rgt36` via `DeployRules` RPC: **succeeded**.

---

## 8. Features Explicitly Deferred for Firebase Blaze Upgrade

The following capabilities require privileged server-side execution (Cloud Functions / Cloud Scheduler / KMS / FCM) and are intentionally NOT simulated on Starter Tier:
1. **Cryptographically Signed QR Check-In Passes**: Server-side HMAC/JWT token issuance, short-lived rotation, revocation lists, and server-verified camera scanning.
2. **Automatic Background Waitlist Promotion**: Triggering instant FIFO promotion when a confirmed student cancels while no organizer is online.
3. **Scheduled Waitlist Offer Expiry Sweeps**: Cloud Scheduler jobs expiring unclaimed waitlist offers automatically.
4. **Automated Push / Email Dispatch**: Background FCM push notifications or transactional email alerts for waitlist promotions, event announcements, and post-event feedback prompts.

---

## 9. Verification Summary

### Verified at Runtime
- **Unit Tests**: `npx --yes tsx --test src/utils/*.test.ts` — **74/74 passing, 0 failed** (including capacity/concurrency simulation, FIFO waitlist sorting & expired-offer skipping, all 11 QR token validation paths, attendance summary & duplicate check-in protection, post-event feedback eligibility & UID anonymization, and Phase 8 announcement notifications).
- **Firestore Rules Static Lint & Live Deploy**: `npx eslint firestore.rules` exited 0 (0 errors, 0 warnings) and deployed live via `DeployRules`.
- **Production Bundle Build**: `npm run build` succeeded in 1.71s; Organizer Operations code remains cleanly isolated inside the lazy-loaded `OrganizerDashboard` chunk (`index` gzip 61.51 kB, `OrganizerDashboard` gzip 60.38 kB).
- **Real Chromium Browser Verification (`playwright-cli`)**: Verified desktop (`1440x900`), mobile (`390x844`), and compact mobile (`320x640`) across Discover and My Events with **0 console errors, 0 warnings, and 0px horizontal overflow**.

### Not Verified in Automated Live Runtime
- **Interactive Signed-In Google OAuth & Live Firestore Writes**: Headless Chromium cannot complete interactive Google OAuth consent flows; live end-to-end authenticated registration, organizer check-in, announcement publishing, and post-event feedback writes should be spot-checked interactively by signing into the deployed app with student and organizer accounts.
- **Firestore Rules Emulator Execution**: Local Java Runtime (JRE) is unavailable in this environment, so `firestore.rules` was verified via ESLint rules linting + live deployment + pure-function mirroring tests rather than local emulator runtime tests.
