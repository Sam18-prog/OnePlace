# School Administrator Guide

This guide covers day-to-day operational responsibilities for School Administrators inside **Organizer Studio**.

---

## 1. Role & Membership Management

Under **Organizer Studio → Settings → Club Organizer & Member Roles**:

- **Granting Roles**: Ask the user for their Support ID from **Profile → Need organizer access? Show account support ID**, then save them as `student`, `organizer`, or `admin` with status `active`.
- **Club Scoping**: Assigning `role: "organizer"` allows dashboard access, while club-level permissions are scoped under **Clubs → Manage Organizers**. Always assign organizers only to clubs they are authorized to represent.
- **Suspending an Account**: Change a member's status to `suspended`. Firestore security rules immediately block suspended accounts from creating RSVPs, following clubs, submitting feedback, or creating/editing events.

---

## 2. School Profile, Branding & Status

Under **Settings → School Configuration** and **Launch**:

- Maintain official school name, canonical IANA timezone, campus location, welcome description, activities contact, and optional HTTPS logo/cover image URLs.
- **Operational Status**:
  - `pending_setup`: Displays a pilot setup notice while staff verify clubs and schedules.
  - `active`: Standard live mode for approved students.
  - `suspended`: Displays a maintenance notice banner.
- Changing school status or pilot stage always requires explicit administrator confirmation.

---

## 3. Importing Real Campus Data (CSV)

Under **Settings → Controlled CSV Campus Data Import**:

1. **Import Clubs First**: Switch to **Clubs CSV**, download the template, fill in genuine clubs, and upload or paste rows. Review the Valid / Duplicate / Error preview before confirming. Club import **never** overwrites existing clubs and **never** auto-assigns organizer roles.
2. **Import Events Second**: Switch to **Events CSV**, download the template, match `clubId` or `clubName` to an active registered club, and import as **Draft** first so you can review dates, times, and locations before publishing.

---

## 4. Campus Announcements & Feedback Triage

- **Campus Announcements** (`Settings → Campus Announcement`): Publish official notices (`normal` or `important`) to `/schools/{schoolId}/announcements`. Active school members see notices in their In-App Notification Center.
- **Campus Feedback Inbox** (`Settings → Campus Feedback Inbox`): Filter private feedback submissions by status (`new`, `reviewed`, `resolved`) or type (`bug`, `feature`, `usability`, `general`), add internal notes, and resolve items during pilot trials.

---

## 5. Backups & Starter Tier Limitations

- **Manual JSON Backup Export** (`Settings → Operational Backup Snapshot (JSON)`): Download a PII-free JSON backup of school configuration, clubs, and events before major changes and on a regular weekly schedule during pilots.
- **Starter Tier Disclosure**: Automated daily Firestore exports, server-side tamper-proof audit logs, scheduled 24h/1h reminder jobs, and FCM push fan-out require upgrading the Firebase project to the Blaze plan and deploying Cloud Functions.
