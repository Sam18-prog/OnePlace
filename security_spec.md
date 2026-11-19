# Security Specification: OnePlace Event Management, Clubs, RBAC & RSVP

## 1. Data Invariants
1. **School-Scoped Role Integrity (`/schools/{schoolId}/members/{uid}`)**: Only verified School Administrators (or the bootstrapped root administrator) may create or update membership records. Ordinary users and organizers cannot grant themselves elevated roles, activate suspended memberships, or read other members' PII (`email`).
2. **Club Schema & Lifecycle Integrity (`/schools/{schoolId}/clubs/{clubId}`)**:
   - Every club belongs to a valid `schoolId` and enforces strict required/allowed keys, bounded string lengths, validated `ClubCategory`, validated HTTPS/curated image URLs, and server-verified timestamps (`createdAt == request.time`, `updatedAt == request.time`, `lastActivityAt == request.time`).
   - `id`, `schoolId`, `slug`, `createdBy`, and `createdAt` are immutable after creation.
   - `discoverKey` is deterministically bound to `status`, `visibility`, and `schoolId` (`public:<schoolId>`, `school:<schoolId>`, or `suspended:<schoolId>`) so suspended clubs and school-only clubs never leak into public list queries.
   - Only School Admins may create clubs, toggle `status` (`active` <-> `suspended`), change `isOfficial` or `visibility`, or assign club organizers.
   - Club Organizers assigned via `/schools/{schoolId}/clubs/{clubId}/members/{uid}` (`status == 'active'`) may only edit permitted profile details (`shortDescription`, `description`, `coverImageUrl`, `logoUrl`, `meetingSchedule`, `meetingLocation`, `contactEmail`, `announcement`, `updatedAt`, `lastActivityAt`) for their assigned clubs. They cannot alter `followerCount`, `status`, `isOfficial`, `schoolId`, or unassigned clubs.
3. **Club-Scoped Organizer Roster (`/schools/{schoolId}/clubs/{clubId}/members/{uid}` & `/users/{uid}/managedClubs/{clubId}`)**:
   - Only School Admins may assign or revoke club organizer access.
   - Organizers can read their own `/users/{uid}/managedClubs` index, while Firestore Rules authoritatively verify `/schools/{schoolId}/clubs/{clubId}/members/{uid}.status == 'active'` on every write.
4. **Atomic Club Follow Synchronization (`/schools/{schoolId}/clubs/{clubId}/followers/{uid}` & `/users/{uid}/followedClubs/{clubId}`)**:
   - Only verified signed-in users allowed to view an `active` club may follow it.
   - Suspended clubs cannot accept new followers.
   - Following requires a 3-document atomic batch creating `/schools/{schoolId}/clubs/{clubId}/followers/{uid}`, creating `/users/{uid}/followedClubs/{clubId}`, and incrementing `followerCount` by exactly `+1` (`!exists` before, `existsAfter` after).
   - Unfollowing requires a 3-document atomic batch deleting both follow documents and decrementing `followerCount` by exactly `-1` (`followerCount >= 1`).
   - Listing `/schools/{schoolId}/clubs/{clubId}/followers` is strictly denied to prevent student enumeration.
   - Follow owners may update only their `notificationsEnabled` boolean preference.
5. **Event Schema, Club Binding & Lifecycle Integrity (`/events/{eventId}`)**:
   - Every new event must reference an existing `active` club in `/schools/{schoolId}/clubs/{clubId}`.
   - Inactive or suspended clubs cannot publish new events (creating or transitioning `draft -> published` fails if the club's `status != 'active'`).
   - Only active Club Organizers assigned to `clubId` (or School Admins) may create events for that `clubId`. Organizers may only edit/publish/cancel their own events and cannot reassign an event to an unassigned club.
   - `endAt` must be strictly greater than `startAt`; `createdAt`/`updatedAt` must match `request.time`; `rsvpCount` cannot be changed via organizer/admin edits.
   - Hard deletion (`delete`) on `/events` and `/schools/{schoolId}/clubs` is disabled; soft status transitions (`cancelled` / `suspended`) preserve auditability.
6. **Visibility & Draft Protection**:
   - Unauthenticated visitors may only read (`get` / `list`) `published`/`cancelled` events and `active` clubs with `visibility == 'public'`.
   - `visibility == 'school'` events and clubs require active school membership.
   - `draft` events are readable only by their `createdBy` organizer or a School Admin.
7. **Atomic RSVP Synchronization (`/events/{eventId}/attendees/{attendeeId}`)**:
   - RSVPs are allowed only for `published` events visible to the verified user.
   - Incrementing/decrementing `rsvpCount` by `+/-1` is strictly bound to creating/deleting `/events/{eventId}/attendees/{request.auth.uid}`.
   - Listing `/events/{eventId}/attendees` is strictly denied.

## 2. Adversarial Payloads (Must All Be Denied)
1. **Unauthenticated Follow/RSVP Write**: Signed-out request creates `/schools/oakridge-high/clubs/robotics/followers/u1` or `/events/evt-1/attendees/u1`. -> DENIED.
2. **Unverified Email Write**: Signed-in user with `email_verified: false` follows a club, creates an event, or RSVPs. -> DENIED.
3. **Self-Role & Club-Organizer Escalation**: Student writes `/schools/oakridge-high/members/{uid}` or `/schools/oakridge-high/clubs/robotics/members/{uid}` to promote themselves. -> DENIED.
4. **Cross-Club Tampering by Organizer**: Organizer assigned only to `robotics` updates `debate-society` metadata or creates an event with `clubId: "debate-society"`. -> DENIED.
5. **Suspended Club Publishing**: Organizer of a `suspended` club creates a new event or transitions a draft event to `published`. -> DENIED.
6. **Follower Count Manipulation & Duplicate Follow**: User updates `followerCount` directly (`+10` or `-1` without follower doc) or creates a duplicate follower document. -> DENIED.
7. **Follower List & School Member Scraping**: Student attempts to `list` `/schools/oakridge-high/clubs/robotics/followers` or `/schools/oakridge-high/members`. -> DENIED.
8. **Suspended Club Public Leakage**: Unauthenticated visitor or student queries `/schools/oakridge-high/clubs` expecting suspended clubs (`discoverKey: "suspended:..."`) or gets a suspended club they do not manage. -> DENIED.
9. **Organizer Modifying Restricted Club Fields**: Club Organizer attempts to change club `isOfficial: true`, `status: "active"`, `schoolId`, or `followerCount`. -> DENIED.
10. **Cross-Organizer Event Tampering**: Organizer A updates or cancels an event where `createdBy == "organizer-b"`. -> DENIED.
11. **Shadow Field Injection / Client Timestamp Spoofing**: Request creates a club, follower, or event with extra undeclared keys or backdated `createdAt != request.time`. -> DENIED.
12. **RSVP on Cancelled/Draft Event or Follow on Suspended Club**: Verified student attempts atomic RSVP on a cancelled/draft event or atomic follow on a suspended club. -> DENIED.

## 3. Phase 4 Notification, Push & Announcement Invariants
1. **In-App Notifications (`/users/{uid}/notifications/{notificationId}`)**:
   - Strictly readable (`get` / `list`) only by the owning recipient `uid` (`resource.data.recipientUid == request.auth.uid`).
   - Client `create` and `delete` are strictly `false`; only trusted backend Cloud Functions (Firebase Admin SDK) create notifications or perform retention cleanup.
   - Client `update` is strictly restricted to the owning verified user marking unread notifications read (`affectedKeys().hasOnly(['status', 'readAt'])`, `existing().status == 'unread'`, `incoming().status == 'read'`, `incoming().readAt == request.time`, and immutable fields verified).
2. **Notification Preferences & Interests (`/users/{uid}/notificationPreferences/{settingId}`)**:
   - Strictly `settingId == 'settings'` and readable/writable only by owning user `uid`.
   - Strict schema blueprint validates boolean reminder/club/announcement/channel flags, bounded `interestCategories` array (`size <= 6`, first item validated if non-empty against canonical event categories), immutable `uid`, and server `updatedAt == request.time`.
3. **Device Push Tokens (`/users/{uid}/deviceTokens/{tokenId}`)**:
   - Strictly readable, creatable, updatable, and deletable only by the owning verified user `uid`.
   - Never stores service-account credentials or server secrets; validates token length (`16..512`), `platform == 'web'`, `permissionState`, and server timestamps (`createdAt == request.time` on create, `updatedAt == request.time`).
4. **Notification Jobs (`/schools/{schoolId}/notificationJobs/{jobId}`)**:
   - Client `create`, `update`, and `delete` are strictly `false` (server Admin SDK only).
   - School Admins may inspect job history (`get`, `list`); students and unauthenticated users are denied.
5. **School Announcements (`/schools/{schoolId}/announcements/{announcementId}`)**:
   - Only active School Admins may create campus announcements (`createdBy == request.auth.uid`, `createdAt == request.time`).
   - Readable by verified active school members and School Admins.

## 4. Phase 4 Adversarial Payloads (Must All Be Denied)
13. **Cross-User Notification Read/Update**: User B queries or updates `/users/{userA}/notifications/{notifId}`. -> DENIED.
14. **Client Notification Forgery**: Signed-in student calls `setDoc` on `/users/{ownUid}/notifications/{fakeId}` or `/users/{otherUid}/notifications/{fakeId}` attempting to inject a fake campus announcement. -> DENIED.
15. **Tampering Immutable Notification Fields**: Owner tries to edit `title`, `message`, `type`, or reset `read -> unread` via `updateDoc`. -> DENIED.
16. **Notification Job Trigger Spoofing**: Client writes directly to `/schools/oakridge-high/notificationJobs/{jobId}` hoping to trigger mass push fan-out. -> DENIED.
17. **Cross-User Device Token Hijack**: User A registers or reads FCM token under `/users/{userB}/deviceTokens/{tokenId}`. -> DENIED.
18. **Unauthorized Campus Announcement**: Student or Club Organizer attempts to create a document under `/schools/oakridge-high/announcements/{id}`. -> DENIED.

## 5. Phase 5 Analytics Access Control, Privacy & Starter Tier Invariants
1. **Role & School Isolation**:
   - Students, suspended accounts, and unauthenticated visitors have zero access to Organizer Studio or Analytics (`capabilities.canAccessOrganizer == false`, and `filterAuthorizedClubsForAnalytics` / `filterAuthorizedEventsForAnalytics` return `[]`).
   - Club Organizers (`role == 'organizer'`) may view analytics strictly for their own events (`createdBy == uid`) and published/cancelled events hosted by clubs explicitly assigned in `/users/{uid}/managedClubs/{clubId}` within their `schoolId`. Unassigned clubs and cross-school records are excluded.
   - School Administrators (`role == 'admin'`) may access the School Administrator Analytics section strictly for their assigned `schoolId`.
2. **Attendee & Member Privacy Preservation**:
   - `firestore.rules` remains unmodified in Phase 5: `allow list: if false;` on `/events/{eventId}/attendees`, `/schools/{schoolId}/clubs/{clubId}/followers`, and `/schools/{schoolId}/members` is strictly preserved.
   - Phase 5 analytics read only trusted aggregate counters (`events/{eventId}.rsvpCount`, `clubs/{clubId}.followerCount`) and event/club metadata.
   - Analytics UI views and RFC 4180 CSV exports never access or include student attendee UIDs, student emails, club contact emails, or `createdBy` UIDs.
3. **No Client-Side Telemetry Spoofing**:
   - No client write paths exist for view counters, bookmark/save counters, or synthetic analytics aggregates on Starter Tier (`ANALYTICS_TRACKED_CAPABILITIES` explicitly reports uncollected metrics as `false`).
4. **Future-Compatible Server-Aggregated Analytics Paths (Blaze Upgrade)**:
   - Future server-aggregated documents (`schools/{schoolId}/analytics/{periodId}`, `clubs/{clubId}/analytics/{periodId}`, `events/{eventId}/analytics/{periodId}`) follow strict write-denial for clients (`allow create, update, delete: if false;`), populated exclusively via Firebase Admin SDK triggers and scheduled Cloud Scheduler jobs.
   - Read rules when enabled: School analytics readable only by active School Admins of `schoolId`; Club/Event analytics readable only by active assigned Club Organizers of `clubId` or School Admins of `schoolId`.

## 6. Phase 5 Adversarial Payloads (Must All Be Denied)
19. **Student Analytics Scope Bypass**: Student queries organizer analytics helpers or navigates to Organizer Studio expecting analytics/CSV access. -> DENIED (UI route blocked + pure scope filters return empty arrays).
20. **Cross-Club Analytics Snooping**: Organizer assigned only to `robotics-club` queries `debate-club` draft events or `debate-club` analytics. -> DENIED by `firestore.rules` (`allow list` on drafts / private reads) and `filterAuthorizedClubsForAnalytics`.
21. **Cross-School Admin Analytics Access**: Admin of `oakridge-high` attempts to read `/events` or `/schools/westview-high/clubs` or export `westview-high` records. -> DENIED (`schoolId` rule mismatch + scope filter isolation).
22. **Student PII Scraping via Analytics or CSV Export**: Client attempts to list `/events/{eventId}/attendees` or inject student emails/UIDs into CSV exports. -> DENIED (`allow list: if false;` in `firestore.rules` + aggregate-only CSV schema).
23. **Arbitrary Client Analytics Write**: Client attempts to write spoofed counts directly to `/schools/{schoolId}/analytics/{periodId}` or `/events/{eventId}.rsvpCount`. -> DENIED (`firestore.rules` default deny / atomic batch enforcement).

## 7. Phase 6 Production Hardening & Multi-School Isolation Invariants
1. **Cross-School Mirror Overwrite Prevention (`/userMemberships/{uid}` & `/users/{uid}/managedClubs/{clubId}`)**:
   - `create` and `update` rules are split explicitly.
   - On `update`, the caller must be an active School Admin of `existing().schoolId`, and `incoming().schoolId == existing().schoolId` is strictly enforced so an admin of School B cannot hijack or overwrite a School A member's membership mirror or managed club assignment.
2. **Default-School Bootstrap Scoping**:
   - The bootstrapped administrator email (`sameerkunwar995@gmail.com`) is scoped strictly to `'oakridge-high'` (`isBootstrappedAdmin(schoolId)` requires `schoolId == 'oakridge-high'`), preventing unintended cross-school super-admin privileges when a second school is onboarded.
3. **Suspended Account Write Blocking on Public Resources**:
   - Even when an event or club has `visibility == 'public'`, a user whose `/schools/{schoolId}/members/{uid}` document has `status == 'suspended'` is explicitly blocked (`!isSuspendedSchoolMember(schoolId)`) from creating new RSVPs or new club follows, while still permitted to cancel their own existing RSVP or unfollow.
4. **Path-Variable & Update-Gap Validation**:
   - `allow list` rules on `/users/{uid}/followedClubs` and `/users/{uid}/managedClubs` are separated from `allow get` so `isValidId(clubId)` is only applied to single-document operations, and `allow update` on follow notification toggles validates immutable fields and full document schema.
   - `publicOrganizers` in `isValidClub` enforces bounded list size (`<= 8`) and validates element map structure (`hasOnly(['uid', 'displayName', 'roleTitle'])` and bounded `displayName`) on index 0.

## 8. Phase 6 Adversarial Payloads (Must All Be Denied)
24. **Cross-School Admin Membership Hijack**: Admin of `westview-high` sends `update` to `/userMemberships/{oakridgeStudentUid}` attempting to reassign `schoolId: "westview-high"` or elevate/suspend a student from `oakridge-high`. -> DENIED (`isSchoolAdmin(existing().schoolId)` and `incoming().schoolId == existing().schoolId`).
25. **Suspended Student Public RSVP/Follow Bypass**: Suspended member of `oakridge-high` attempts atomic RSVP `+1` on a `visibility: "public"` event or follow `+1` on a `visibility: "public"` club. -> DENIED (`!isSuspendedSchoolMember(...)`).
26. **Bootstrapped Admin Cross-School Access**: Bootstrapped email for `oakridge-high` attempts to write or read admin collections under `/schools/westview-high/...` without an explicit `westview-high` admin membership document. -> DENIED (`schoolId == 'oakridge-high'`).
27. **Public Organizer Payload Poisoning**: Admin/client writes `publicOrganizers: [{ email: "leak@school.edu", extra: true }]` into `/schools/oakridge-high/clubs/{clubId}`. -> DENIED (`isValidClub` map-key guard).

## 9. Phase 7 Launch, Onboarding & Feedback Invariants
1. **Rich School Profile & Pilot Lifecycle (`/schools/{schoolId}`)**:
   - Only active School Administrators of `schoolId` may update school branding (`logoUrl`, `coverImageUrl`, `description`, `location`, `contactEmail`, `contactName`), operational `status` (`active`, `pending_setup`, `suspended`), `pilotStage`, and `onboardingChecklist`.
   - Students and Club Organizers cannot create a new school document or elevate themselves into an administrator.
2. **School-Scoped User Feedback (`/schools/{schoolId}/feedback/{feedbackId}`)**:
   - Verified, non-suspended signed-in users may create feedback with `submittedBy == request.auth.uid`, `status == 'new'`, bounded description (`10..1200`), valid `type`, and server timestamps (`createdAt == request.time`, `updatedAt == request.time`).
   - Students can NEVER read (`get` or `list`) another student's feedback submissions (`resource.data.submittedBy == request.auth.uid`).
   - Only active School Administrators of `schoolId` may list all school feedback and update `status` (`new` | `reviewed` | `resolved`), `adminNote`, and `updatedAt` while preserving immutable submission fields.
3. **User Onboarding Progress (`/users/{uid}/onboarding/progress`)**:
   - Strictly owner-only (`isOwner(uid)` and `isVerifiedUser()`) and restricted to `docId == 'progress'`.
   - Stores strictly UI checklist booleans (`studentCompleted`, `studentDismissed`, `organizerDismissed`, `clubProfileReviewed`, `eventManagementReviewed`); contains zero RBAC fields and NEVER grants permissions.

## 10. Phase 7 Adversarial Payloads (Must All Be Denied)
28. **Self-Service School Creation & Admin Takeover**: Ordinary student calls `setDoc` on `/schools/new-school` hoping to register a school and become its admin. -> DENIED (`isSchoolAdmin(schoolId)` fails).
29. **Student Feedback Scraping**: Signed-in Student A queries `list` on `/schools/oakridge-high/feedback` without restricting to `submittedBy == uid` or attempts `get` on Student B's feedback document. -> DENIED.
30. **Feedback Status Forgery or Tampering**: Student creates feedback with `status: "resolved"` or `adminNote: "Approved"`, or tries to `update` their own feedback status after creation. -> DENIED.
31. **Cross-School Feedback Admin Read**: Admin of `westview-high` attempts to list or update `/schools/oakridge-high/feedback/{id}`. -> DENIED (`isSchoolAdmin(schoolId)`).
32. **Onboarding Privilege Injection**: User writes `{ role: "admin", isOrganizer: true }` into `/users/{uid}/onboarding/progress`. -> DENIED (`isValidUserOnboardingProgress` strict `hasOnly`).

## 11. Phase 8 Advanced Event Operations, Capacity, Waitlist, Attendance & Feedback Invariants
1. **Authoritative Server-Side Capacity Enforcement (`/events/{eventId}` & `/events/{eventId}/registrations/{uid}`)**:
   - Every confirmed registration transition (`create` or `update` to `status == 'confirmed'`, AND legacy `/attendees/{uid}` create) MUST satisfy `capacityLimit == null || rsvpCount + 1 <= capacityLimit` inside Firestore Security Rules AND atomic transactions.
   - Closed (`registrationStatus == 'closed'`), cancelled, draft, or ended events (`request.time >= endAt`), and out-of-window timestamps (`registrationOpensAt` / `registrationClosesAt`), are rejected by Firestore Rules.
   - Duplicate active registrations across legacy `/attendees/{uid}` and `/registrations/{uid}` are prevented (`!exists(eventAttendeePath(eventId, uid))` on registration create).
2. **Waitlist Order & Promotion Integrity (`/events/{eventId}/registrations/{uid}`)**:
   - Students joining a waitlist MUST set `waitlistTimestamp == request.time`, preventing any client-side queue jumping.
   - Students can NEVER read (`get`/`list`) other students' registration records; `list` is strictly restricted to authorized event organizers (assigned to `event.clubId` in `event.schoolId`) and School Admins of `event.schoolId`.
   - Only authorized event organizers or School Admins may approve `pending_approval -> confirmed` or promote `waitlisted -> confirmed`, always enforcing `capacityLimit` atomically.
3. **Attendance & Check-In Authority (`/events/{eventId}/attendance/{uid}`)**:
   - Students may `get` ONLY their own attendance status (`isOwner(uid)`).
   - Students can NEVER `create`, `update`, `delete`, or `list` attendance records (`allow create, update` strictly requires `isEventManagerData(event)` and `checkedInBy == request.auth.uid`).
   - Cryptographically signed QR tokens are NOT minted or validated client-side on Starter Tier; predictable `eventId:uid` QR codes are explicitly prohibited.
4. **Event Announcements (`/events/{eventId}/announcements/{announcementId}`)**:
   - Readable (`get`, `list`) only by users authorized to view the parent event (`canViewEventData(event)`), with non-managers restricted to `status == 'active'`.
   - Writable (`create`, `update`) strictly by authorized event organizers or School Admins of `event.schoolId`.
5. **Post-Event Feedback Privacy & Anti-Duplication (`/events/{eventId}/feedback/{uid}`)**:
   - Document ID MUST equal `request.auth.uid` (`id == uid` and `submittedBy == request.auth.uid`), preventing duplicate submissions per event.
   - Submission is allowed ONLY after the event ends (`request.time >= event.endAt`) by a verified, non-suspended participant who holds a confirmed registration, legacy RSVP, or `checked_in` attendance record.
   - Students can NEVER read other students' feedback (`get` is strictly `isOwner(uid)` or authorized organizer/admin; `list` is strictly authorized organizer/admin). Organizer summaries strip `submittedBy` before rendering comments.

## 12. Phase 8 Adversarial Payloads (Must All Be Denied)
33. **Capacity Limit Bypass**: Verified student attempts to write `status: "confirmed"` (or create legacy `/attendees/{uid}`) when `rsvpCount == capacityLimit`. -> DENIED by `hasCapacityForOneMore` in `firestore.rules`.
34. **Waitlist Queue Manipulation**: Student writes backdated `waitlistTimestamp` (e.g. year 2020) when joining waitlist to jump to position #1. -> DENIED (`incoming().waitlistTimestamp == request.time`).
35. **Student Self-Check-In**: Student calls `setDoc` on `/events/{eventId}/attendance/{ownUid}` with `status: "checked_in"`. -> DENIED (`isEventManagerData` fails).
36. **Student Registration/Feedback Scraping**: Student calls `list` on `/events/{eventId}/registrations`, `/events/{eventId}/attendance`, or `/events/{eventId}/feedback`. -> DENIED.
37. **Unauthorized Event Announcement**: Student or organizer from an unassigned club attempts to create `/events/{eventId}/announcements/{id}`. -> DENIED.
38. **Premature, Ineligible, or Duplicate Event Feedback**: Unregistered student, cancelled registrant, or student before `event.endAt` submits `/events/{eventId}/feedback/{uid}`, or tries to overwrite/update an existing feedback record. -> DENIED.
39. **Cross-School Check-In or Registration Approval**: Organizer or Admin from `westview-high` attempts to check in an attendee or approve a registration for an `oakridge-high` event. -> DENIED.
