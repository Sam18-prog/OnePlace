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
