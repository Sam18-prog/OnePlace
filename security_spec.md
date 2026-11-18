# Security Specification: OnePlace Event Feed & RSVP

## 1. Data Invariants
1. **Event Schema Integrity**: Every `/events/{eventId}` document must contain exact keys `['title', 'hostClub', 'dateTime', 'location', 'description', 'rsvpCount']`, bounded string lengths (`title <= 120`, `hostClub <= 80`, `location <= 120`, `description <= 600`), a Firestore `timestamp` for `dateTime`, and a non-negative integer `rsvpCount` (`0..100000`).
2. **Attendee Identity & Ownership**: Every `/events/{eventId}/attendees/{attendeeId}` document must use `attendeeId == request.auth.uid`, match `incoming().uid == request.auth.uid`, and set `createdAt == request.time`.
3. **Atomic RSVP Synchronization**: Incrementing `rsvpCount` by `+1` on `/events/{eventId}` is permitted ONLY in an atomic batch that creates `/events/{eventId}/attendees/{request.auth.uid}` (and vice versa `-1` when deleting). Unauthenticated users and unverified emails cannot mutate state.
4. **No Attendee Scraping / PII Isolation**: Listing `/events/{eventId}/attendees` is strictly denied; a student can only read (`get`) their own `/attendees/{uid}` document.
5. **Path Hardening**: All `eventId` and `attendeeId` path variables must satisfy `isValidId(id)` (`^[a-zA-Z0-9_-]+$`, `<= 128` chars).

## 2. "Dirty Dozen" Adversarial Payloads (Must All Be Denied)
1. **Unauthenticated RSVP Write**: Anonymous/signed-out request creates `/events/evt-robotics/attendees/user-1`. -> DENIED.
2. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts to RSVP or seed an event. -> DENIED.
3. **Identity Spoofing on Attendee Create**: User A (`uid: "alice"`) tries to create `/events/evt-robotics/attendees/bob` with `uid: "bob"`. -> DENIED.
4. **Mismatched Internal UID**: User A (`uid: "alice"`) creates `/events/evt-robotics/attendees/alice` with body `{ uid: "bob", createdAt: request.time }`. -> DENIED.
5. **Shadow Field Injection on Event**: Signed-in user creates `/events/evt-1` with an extra ghost field `{ ..., isOfficial: true }`. -> DENIED.
6. **Shadow Field Injection on Attendee**: Signed-in user creates attendee with `{ uid: "alice", createdAt: request.time, role: "admin" }`. -> DENIED.
7. **Arbitrary RSVP Count Inflation**: Signed-in user updates `/events/evt-robotics` setting `rsvpCount: 9999` without an atomic attendee write. -> DENIED.
8. **Orphaned Attendee Write (No Batch Count Sync)**: User creates `/events/evt-robotics/attendees/alice` standalone without incrementing parent `rsvpCount`. -> DENIED.
9. **Event Metadata Tampering via Update**: Signed-in user updates `title` or `location` on an existing `/events/evt-robotics` document. -> DENIED.
10. **Client-Spoofed Timestamp**: User creates attendee with a client-supplied past/future `createdAt` instead of `request.time`. -> DENIED.
11. **Resource Exhaustion / ID Poisoning**: User creates `/events/aaaa...(200 chars)` or injects a 1MB `description`. -> DENIED.
12. **Attendee List Scraping**: Signed-in user attempts to `list` `/events/evt-robotics/attendees` to enumerate all student attendees. -> DENIED.
