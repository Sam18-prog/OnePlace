# Security Specification: OnePlace Event Management, RBAC & RSVP

## 1. Data Invariants
1. **School-Scoped Role Integrity (`/schools/{schoolId}/members/{uid}`)**: Only verified School Administrators (or the bootstrapped root administrator) may create or update membership records. Ordinary users and organizers cannot grant themselves elevated roles, activate suspended memberships, or read other members' PII (`email`).
2. **Event Schema & Lifecycle Integrity (`/events/{eventId}`)**:
   - Every event must include required fields (`id`, `schoolId`, `title`, `description`, `hostClub`, `clubId`, `category`, `startAt`, `endAt`, `timezone`, `location`, `createdBy`, `createdAt`, `updatedAt`, `status`, `visibility`, `rsvpCount`, `discoverKey`) with bounded sizes and strict enum checks.
   - `endAt` must be strictly greater than `startAt`.
   - `createdAt` and `updatedAt` must match `request.time` on creation; `updatedAt` must match `request.time` on edits; `id`, `schoolId`, `createdBy`, and `createdAt` are immutable after creation.
   - `discoverKey` is deterministically bound to `status`, `visibility`, `schoolId`, and `createdBy` so public, school-only, and draft queries cannot bleed across authorization boundaries.
3. **Organizer & Admin Ownership**:
   - Only active `organizer` or `admin` members for `schoolId` may create events.
   - Organizers may only edit, publish, or cancel events where `existing().createdBy == request.auth.uid`.
   - School Admins may manage all events in their `schoolId` and migrate legacy Phase 1 documents without overwriting `rsvpCount` or deleting `/attendees`.
   - Neither organizers nor admins may alter `rsvpCount` via event editing.
   - Hard deletion (`delete`) on `/events` is disabled; events are soft-cancelled (`status: 'cancelled'`).
4. **Visibility & Draft Protection**:
   - Unauthenticated visitors may only read (`get` / `list`) `published` or `cancelled` events with `visibility == 'public'`.
   - `visibility == 'school'` events require active school membership (`schools/{schoolId}/members/{uid}.status == 'active'` or bootstrapped admin).
   - `draft` events are readable only by their `createdBy` organizer or a School Admin.
5. **Atomic RSVP Synchronization (`/events/{eventId}/attendees/{attendeeId}`)**:
   - RSVPs are allowed only for `published` events (`status == 'published'`) that the verified user is allowed to view (`visibility == 'public'` or active school member).
   - Cancelled and draft events cannot accept new RSVPs.
   - Incrementing `rsvpCount` by `+1` requires an atomic batch creating `/events/{eventId}/attendees/{request.auth.uid}` (`uid == request.auth.uid`, `createdAt == request.time`). Decrementing `-1` requires atomically deleting that same document.
   - Listing `/events/{eventId}/attendees` is strictly denied to prevent student enumeration.

## 2. Adversarial Payloads (Must All Be Denied)
1. **Unauthenticated RSVP Write**: Signed-out request creates `/events/evt-1/attendees/user-1`. -> DENIED.
2. **Unverified Email Write**: Signed-in user with `email_verified: false` creates an event or RSVP. -> DENIED.
3. **Self-Role Escalation**: Student writes `/schools/oakridge-high/members/{uid}` with `{ role: "organizer", status: "active" }`. -> DENIED.
4. **Suspended Organizer Write**: Member with `role: "organizer"` and `status: "suspended"` creates or edits an event. -> DENIED.
5. **Cross-Organizer Tampering**: Organizer A updates or cancels an event where `createdBy == "organizer-b"`. -> DENIED.
6. **Organizer RSVP Count Manipulation**: Organizer edits own event with `rsvpCount: 500` in the payload. -> DENIED.
7. **Draft Leakage to Public/Students**: Unauthenticated user or student queries or gets a `draft` event authored by someone else. -> DENIED.
8. **School-Only Event Leakage**: Unauthenticated visitor or non-member reads a `visibility: "school"` event. -> DENIED.
9. **RSVP to Cancelled or Draft Event**: Verified student attempts an atomic RSVP write on a `cancelled` or `draft` event. -> DENIED.
10. **Attendee List Scraping & PII Exposure**: Student attempts to `list` `/events/evt-1/attendees` or `list` `/schools/oakridge-high/members`. -> DENIED.
11. **Shadow Field Injection / Client Timestamp Spoofing**: Organizer creates an event with extra ghost key `{ isFeatured: true }` or `createdAt` in the past (`!= request.time`), or sets `discoverKey: "public:..."` on a `draft`. -> DENIED.
12. **Past Date Publishing / Invalid Time Range**: Organizer publishes an event with `endAt <= startAt` or `startAt` days in the past, or updates `cancelled -> published` without admin permission. -> DENIED.
