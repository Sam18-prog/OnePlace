# OnePlace

**Everything happening. All in OnePlace.**

OnePlace is a mobile-first campus event discovery, club community, and school administration platform built with React 19, TypeScript, Vite, Tailwind CSS v4, Motion, Firebase Authentication, and Cloud Firestore.

- Live deployment: `https://oneplace4all.netlify.app/`
- Repository: `https://github.com/Sam18-prog/OnePlace`
- Firebase project (AI Studio Starter Tier): `thermal-surface-rgt36`

---

## Core Capabilities

- **Student Event Discovery**: Chronological campus feed (Today, This Week, Later), featured spotlight, instant search, category shortcuts, personalized recommendations, and one-tap atomic RSVPs.
- **Campus Clubs & Communities**: Dedicated club directory, official club profiles with meeting schedules/locations, club following, and club-filtered event discovery.
- **In-App Notification Center**: Firestore-backed in-app notifications, school-wide campus announcements, and student notification preferences. Browser push via FCM is strictly optional and activates only when `VITE_FIREBASE_VAPID_KEY` and Cloud Functions are configured.
- **Organizer Studio & Analytics**: Role-based dashboard for club organizers and school administrators to draft, publish, edit, and soft-cancel events, manage assigned clubs, review engagement KPIs, and export PII-free CSV analytics.
- **School Onboarding & Pilot Launch (Phase 7)**:
  - Rich school profile configuration (branding, location, description, contact details, canonical timezone, operational status).
  - 10-step School Onboarding Workflow and 4-stage Controlled Pilot Rollout tracker (`Internal Validation` → `Student Trial` → `Club Expansion` → `School-Wide Release`).
  - Controlled CSV Import for Clubs and Events with row-level validation, duplicate detection, and explicit administrator confirmation.
  - Guided Club Organizer Quick Start checklist and optional, non-blocking 4-step Student Campus Tour.
  - Private, school-scoped User Feedback submission modal and Admin Feedback Inbox.
  - Public Product Landing Page (`About OnePlace` / `?view=about`).
  - Multi-school hostname routing (`VITE_SCHOOL_DOMAIN_MAP`) and allowlisted preview support (`VITE_ALLOWED_QUERY_SCHOOLS`).

---

## Architecture & Multi-School Isolation

- **Database**: Cloud Firestore (`ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`).
- **Tenant Partitioning**: Schools live under `/schools/{schoolId}` with isolated subcollections for `members`, `clubs`, `announcements`, `notificationJobs`, and `feedback`. Events carry explicit `schoolId` and `discoverKey` fields enforced by Firestore Security Rules.
- **Privacy by Design**:
  - Individual event attendees (`/events/{eventId}/attendees/{uid}`) and club followers (`/schools/{schoolId}/clubs/{clubId}/followers/{uid}`) disallow `list` queries so student rosters cannot be enumerated.
  - Analytics exports and Starter Tier JSON backups exclude student emails, attendee lists, and raw user IDs.
  - There is zero self-service organizer or admin escalation; roles are assigned exclusively by authorized school administrators.

---

## Starter Tier vs. Firebase Blaze Features

OnePlace starts and builds cleanly on the AI Studio Starter Tier without requiring `VITE_FIREBASE_VAPID_KEY`, Cloud Functions, or Cloud Scheduler.

| Capability | Starter Tier (Current) | Upgraded Firebase Blaze Project |
| :--- | :--- | :--- |
| Google Sign-In & Verified-Email Gates | Active | Active |
| Cloud Firestore Security Rules & RBAC | Active | Active |
| In-App Notifications & Preferences | Active | Active |
| Organizer Studio, Analytics & CSV Import | Active | Active |
| Manual PII-Free JSON Backup Export | Active | Active |
| Browser Web Push (FCM + VAPID) | Gracefully disabled | Active after VAPID key + Functions |
| Scheduled 24h / 1h Event Reminders | Requires Cloud Scheduler | Active via Cloud Functions |
| Tamper-Proof Server Audit Logs & Daily Backups | Manual timestamps + JSON export | Active via Cloud Logging & Scheduled Exports |

---

## Local Development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` to configure optional school targeting:

- `VITE_SCHOOL_ID` (default: `oakridge-high`)
- `VITE_SCHOOL_NAME` (default: `Oakridge High School`)
- `VITE_SCHOOL_TIMEZONE` (default: `America/Los_Angeles`)
- `VITE_SCHOOL_DOMAIN_MAP` (optional JSON hostname → `schoolId` map)
- `VITE_ALLOWED_QUERY_SCHOOLS` (optional comma-separated allowlist for `?school=` preview)
- `VITE_FIREBASE_VAPID_KEY` (optional; omit on Starter Tier)

### Verification Commands

```bash
npx --yes tsx --test src/utils/*.test.ts   # Pure logic unit tests
npx eslint firestore.rules                 # Firestore security rules static audit
npm run lint                               # TypeScript typecheck (tsc --noEmit)
npm run build                              # Production Vite build
```

---

## Operations & Support Documentation

- [School Onboarding Guide](docs/SCHOOL_ONBOARDING.md)
- [Administrator Guide](docs/ADMIN_GUIDE.md)
- [Club Organizer Guide](docs/ORGANIZER_GUIDE.md)
- [Student Guide](docs/STUDENT_GUIDE.md)
- [Incident Response Playbook](docs/INCIDENT_RESPONSE.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Production Readiness Audit (Phase 6)](PRODUCTION_READINESS.md)
- [Phase 7 Launch Report](PHASE7_LAUNCH_REPORT.md)
