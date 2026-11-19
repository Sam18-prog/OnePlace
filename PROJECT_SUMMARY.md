# OnePlace — Project & Work Summary

**OnePlace** is a mobile-first, unified chronological campus event and club feed built for high school students so club meetings, athletics, and student events are discoverable and RSVP-ready in one place.

---

## 1. Current Tech Stack & Dependencies

- **Frontend Framework**: React 19 (`^19.0.1`) + TypeScript (`^7.0.2`) + Vite (`^8.3.0`)
- **Styling & Typography**: Tailwind CSS v4 (`@tailwindcss/vite` `^4.3.3`) with `Plus Jakarta Sans` (`--font-display`), `DM Sans` (`--font-sans`), and `JetBrains Mono` (`--font-mono`)
- **Motion & Icons**: `motion` (`^12.23.24` via `motion/react`) and `lucide-react` (`^0.546.0`)
- **Backend & Auth**: Firebase (`^13.4.0`) — Google Sign-In (`firebase/auth`) + Cloud Firestore (`firebase/firestore`, database ID `ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`)
- **Testing & Rule Validation**: `node:test` + `tsx` (`^4.21.0`), `eslint` (`^10.15.0`) + `@firebase/eslint-plugin-security-rules`

---

## 2. Project File Structure

```text
/
├── index.html                        # HTML entry point, metadata, Google Fonts, light-mode body styling
├── metadata.json                     # App name ("OnePlace") and description
├── package.json                      # Scripts (dev, build, preview, lint, clean) and dependencies
├── public/
│   └── demo-events.json              # Static JSON feed of 6 chronological campus events
├── firebase-applet-config.json       # Provisioned Firebase project & database configuration
├── firebase-blueprint.json           # Firestore schema blueprint
├── firestore.rules                   # Deployed Firestore security rules (strict atomic RSVP & auth checks)
├── security_spec.md                  # Security & access-control specification
├── eslint.config.js                  # ESLint configuration for Firestore security rules
├── PROJECT_SUMMARY.md                # This project & work summary
└── src/
    ├── main.tsx                      # React root mount
    ├── index.css                     # Tailwind CSS v4 @import + @theme font tokens
    ├── App.tsx                       # Main feed, search, timeframe filters, optimistic RSVP flow, toast
    ├── firebase.ts                   # Firebase init, initializeFirestore w/ long polling & DB ID, Google provider
    ├── types/
    │   └── event.ts                  # TypeScript types (DemoEventRaw, SchoolEvent, TimeframeBucket, GroupedEvents)
    ├── services/
    │   └── rsvpService.ts            # Demo event seeding, live count subscription, user RSVP fetch, atomic batch toggle
    ├── utils/
    │   ├── events.ts                 # Parsing, sorting, timeframe bucketing, filtering, date formatting, Google Calendar URL builder
    │   ├── events.test.ts            # Unit tests for event utilities
    │   ├── rsvp.ts                   # Optimistic RSVP state calculation & 5-second Promise.race timeout helper
    │   └── rsvp.test.ts              # Unit tests for RSVP utilities
    └── components/
        ├── Header.tsx                # Sticky solid-white top bar with OnePlace wordmark, Refresh, and Google Auth controls
        ├── EventCard.tsx             # Elevated white event card with Google Calendar link, RSVP button, live count
        ├── EventSkeleton.tsx         # Loading skeleton cards matching EventCard layout
        ├── SignInPromptModal.tsx     # Modal prompting signed-out users to sign in with Google before RSVPing
        └── ErrorBoundary.tsx         # Top-level React error fallback UI
```

---

## 3. Core Features Implemented

1. **Unified Chronological Event Feed (`/public/demo-events.json` & `src/utils/events.ts`)**:
   - Loads 6 pre-defined campus events (`Robotics Club Build Night`, `Student Council Open Forum`, `Varsity Basketball Home Opener`, `Model UN & Debate Mock Session`, `Fall Acoustic & Jazz Coffeehouse`, `Winter Hackathon Team Mixer`).
   - Automatically parses, sanitizes, sorts chronologically ascending, and groups events into **Today**, **This Week**, and **Later** sections with item counts.
   - Supports instant client-side search (by title or host club), timeframe filter tabs (`All`, `Today`, `This Week`, `Later`), and manual **Refresh** with skeleton loading.

2. **Google Sign-In Authentication (`src/firebase.ts`, `src/components/Header.tsx`, `src/components/SignInPromptModal.tsx`)**:
   - Uses Firebase Authentication (`GoogleAuthProvider` with `signInWithPopup` and `onAuthStateChanged`).
   - Signed-out users clicking **RSVP** are prompted via an accessible modal (`SignInPromptModal`) to sign in with Google before saving an RSVP.
   - Displays user avatar (with fallback icon), display name/email, and **Sign out** in the header when authenticated.

3. **Firestore Persistence & Optimistic RSVP (`src/services/rsvpService.ts`, `src/utils/rsvp.ts`, `src/App.tsx`)**:
   - **Firestore Initialization**: Uses `initializeFirestore(app, { experimentalForceLongPolling: true }, firebaseConfig.firestoreDatabaseId)` to bypass sandbox network restrictions and target the provisioned database.
   - **Schema**:
     - `events/{eventId}`: `title`, `hostClub`, `dateTime` (`Timestamp`), `location`, `description`, `rsvpCount` (`number`)
     - `events/{eventId}/attendees/{uid}`: `uid`, `createdAt` (`serverTimestamp()`)
   - **Security Rules (`firestore.rules`)**: Default-deny posture; verified signed-in users can read events and read only their own `attendees/{uid}` doc (no attendee listing); RSVP updates require an atomic `writeBatch` pairing attendee doc creation/deletion with a `+1`/`-1` `rsvpCount` update.
   - **Optimistic UI & 5s Timeout**: Clicking **RSVP** immediately toggles the UI to **"You're going!"** and updates the visible count before running `writeBatch` in the background wrapped in `withTimeout` (`Promise.race`, 5,000 ms). On failure or timeout, the UI reverts and shows a `"Connection failed."` toast.
   - **Connection Budget Optimization**: Fetches initial per-user RSVPs via `Promise.all` + `getDoc` (`fetchUserRsvps`) and subscribes to live counts with a single collection listener (`subscribeToEventCounts`).

4. **Google Calendar Integration (`src/utils/events.ts`, `src/components/EventCard.tsx`)**:
   - Replaced the initial `.ics` download flow with a direct **"Add to Calendar"** link per event card (`buildGoogleCalendarUrl`).
   - Opens `https://calendar.google.com/calendar/render?action=TEMPLATE...` in a new tab with URL-encoded event title, host club + description details, location, and UTC `YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ` start/end timestamps.

---

## 4. Design & UI Evolution

1. **Initial MVP Scaffold**: Clean mobile-first white utility feed with placeholder/demo JSON data and Firebase integration.
2. **Dark Glassmorphism Iteration**: Refactored to a dark `bg-slate-950` aesthetic with ambient mesh gradients, frosted `bg-white/5 backdrop-blur-xl` cards, `motion/react` staggered card animations, and indigo-purple gradients.
3. **Current Editorial Light Mode Overhaul (Linear / Notion / Apple Aesthetic)**:
   - **Flat Canvas**: `bg-[#F8F9FA]` background with zero gradients or background blurs; sharp `text-slate-900` primary text and `text-slate-500` secondary text.
   - **Header**: Sticky solid white bar (`bg-white border-b border-slate-200`) with bold dark `OnePlace` wordmark (`font-extrabold text-slate-900 tracking-tight`).
   - **Event Cards**: Crisp `bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200`, clean unboxed club kicker text, and tighter `text-xl font-bold text-slate-900 tracking-tight` headings in `Plus Jakarta Sans`.
   - **Solid Accents & Ghost Buttons**: Terracotta/Coral primary CTAs (`bg-[#E85D04] text-white hover:bg-[#DC2F02]`), solid Emerald Green `"You're going!"` state (`bg-emerald-600 text-white`), and ghost-style `"Add to Calendar"` buttons (`bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50`).

---

## 5. Verification Status (Latest State)

- **Unit Tests (`npx --yes tsx --test src/utils/*.test.ts`)**: **39 / 39 passing** across events, clubs, notifications, personalization, RSVPs, and Starter Tier notification derivation.
- **Build & Typecheck**: `npm run build` (`vite build`) and `npm run lint` (`tsc --noEmit`) pass cleanly with `VITE_FIREBASE_VAPID_KEY` unset.
- **Firestore Rules**: Validated with ESLint security-rules plugin (`npx eslint firestore.rules`) and preserved intact on `ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`.
- **Headless Browser Verification (`playwright-cli`)**: Verified desktop (`1440×900`) and mobile (`390×844`) rendering, `0` console errors, `0` registered service workers when VAPID is unconfigured, and clean Discover, Notifications, and mobile Notification Preferences views. *(Live Google Sign-In popup auth and authenticated Firestore writes were not executed inside headless Chromium.)*

---

## 6. Phase 4 Starter Tier Mode vs. Firebase Blaze Upgrade Documentation

OnePlace targets the existing Firebase project **`thermal-surface-rgt36`** (Firestore database **`ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`**). On an **AI Studio Starter Tier** project (no Cloud Billing / Blaze plan, no Web Push VAPID key, and no IAM Admin SDK / Cloud Functions deployment), Phase 4 operates gracefully in **Starter Tier Mode**.

### Operational on AI Studio Starter Tier (Current Default)
1. **Authentication & Core Campus Workflows**: Google Sign-In, event discovery, organizer event management, club directory, club following, and atomic batch RSVPs continue working with `firestore.rules`.
2. **In-App Notification Center (`src/hooks/useNotifications.ts`, `src/utils/starterNotifications.ts`)**:
   - Subscribes to persisted `users/{uid}/notifications` (strictly owner-scoped with `where('recipientUid', '==', uid)` and in-memory descending sort).
   - Derives real-time, preference-filtered in-app alerts from live Firestore documents while the app is open: campus announcements (`schools/{schoolId}/announcements`), followed club updates and upcoming events (`notificationsEnabled: true`), cancelled RSVPed/followed events, and upcoming 24h/1h RSVP windows.
   - Supports read/unread filtering, mark read, and mark all read (Firestore batch updates for persisted docs + per-user `localStorage` tracking for derived Starter Tier items).
3. **Firestore-Backed Notification Preferences (`users/{uid}/notificationPreferences/settings`)**:
   - Persists reminders (`reminder24h`, `reminder1h`), club alerts (`clubNewEvents`, `clubEventUpdates`), campus announcements (`schoolAnnouncements`, `importantNotices`), in-app inbox toggle (`inAppEnabled`), and personalization interest categories.
4. **Optional FCM Guard (`src/services/pushService.ts`)**:
   - `VITE_FIREBASE_VAPID_KEY` is optional. When unset, `firebase/messaging` is never dynamically imported, `firebase-messaging-sw.js` is not registered, `Notification.requestPermission()` is never called, and the UI displays an explicit **Not configured / Push Not Configured** state with no simulated push delivery.

### Backend Features Requiring Firebase Project Upgrade (Blaze Plan)
1. **Web Push Delivery via FCM (`VITE_FIREBASE_VAPID_KEY`)**:
   - Generating a Web Push certificate VAPID key pair in **Firebase Console → Project Settings → Cloud Messaging** (blocked on Starter Tier) and setting `VITE_FIREBASE_VAPID_KEY` enables client opt-in permission prompts, `getToken()`, `users/{uid}/deviceTokens/{tokenId}` registration, and background service worker delivery via `/public/firebase-messaging-sw.js`.
2. **Cloud Functions Event Fan-Out Triggers (`functions/src/index.ts`)**:
   - `onEventWritten` (cross-user fan-out to followers/attendees when events are published, rescheduled, updated, or cancelled)
   - `onClubUpdated` (fan-out to club followers on club announcements)
   - `onSchoolAnnouncementCreated` (fan-out to active school members on new campus announcements)
3. **Cloud Scheduler Background Jobs (`functions/src/index.ts`, `functions/src/reminders.ts`)**:
   - `sendScheduledEventReminders` (`every 15 minutes`) for automated 24h and 1h reminders delivered when the user's browser/tab is closed.
   - `cleanupNotificationArtifacts` (`every sunday 03:00`) for pruning expired notification job logs and stale tokens.
4. **Admin SDK (`firebase-admin`) Cross-User Writes & Composite Indexes**:
   - Server-side `firebase-admin` fan-out writes into recipients' `users/{uid}/notifications` subcollections and deploying composite indexes (`firestore.indexes.json`) via Firebase CLI require a Blaze-enabled project with IAM & Cloud Functions permissions.

---

## 7. Phase 5: Campus Analytics, Event Intelligence & Organizer Insights

### Implemented Components & Pure Modules
1. **Analytics Contracts & Computation Engine (`src/types/analytics.ts`, `src/utils/analytics.ts`)**:
   - Strict RBAC scope filtering (`filterAuthorizedClubsForAnalytics`, `filterAuthorizedEventsForAnalytics`, `mergeDeduplicatedEvents`) isolating Students (`[]`), Organizers (owned events + assigned clubs only), and School Admins (strictly `membership.schoolId`).
   - Timezone-aware (`schoolConfig.timezone`) date presets (`All Time`, `Last 7 Days`, `Last 30 Days`, `Last 90 Days`, `This Semester`, `This Year`, `Custom Range`) supporting filtering by either Event Date (`startAt`) or Created Date (`createdAt`).
   - Exact aggregations for Organizer KPIs, Event Performance rows (with relative vs published mean comparison), Category Breakdown, RSVP Distribution Buckets (`0`, `1–5`, `6–15`, `16–30`, `31+`), Club Engagement rows, Scheduled Month grouping, and School Administrator Rollups.
2. **RFC 4180 CSV Exports (`src/utils/analyticsCsv.ts`)**:
   - Clean browser downloads (`oneplace-<report>-<YYYY-MM-DD>.csv`) for Event Performance, Club Summary, RSVP Aggregate, and Admin-only School Aggregate reports with full quote/comma/newline escaping and zero student PII, emails, or UIDs.
3. **Analytics UI & Organizer Studio Upgrade (`src/components/analytics/*`, `src/components/organizer/OrganizerDashboard.tsx`, `OrganizerOverview.tsx`)**:
   - Upgraded `OrganizerDashboard` navigation to `Overview`, `My Events`, `Clubs`, `Analytics`, and `Settings`.
   - Lightweight editorial SVG/CSS charts (`HorizontalBarChart`, `DonutBreakdownChart`, `RsvpDistributionChart`, `MonthlyScheduleChart`, `EventComparisonPanel`), sortable/filterable/paginated `EventPerformanceTable`, `ClubComparisonSection`, `SchoolAdminAnalyticsSection`, and `AnalyticsDashboard` disclosure of Starter Tier measurement boundaries (`ANALYTICS_DATA_LIMITATIONS`).

### Starter Tier Honesty vs. Blaze Analytics Upgrade
- **Available on Starter Tier**: Cumulative `rsvpCount` intent totals, event status & category distributions, monthly scheduled volume (`startAt`), club `followerCount` totals, and client-scoped CSV reports using existing bounded Firestore queries without weakening `firestore.rules`.
- **Requires Blaze Upgrade (Future `FutureAnalyticsAggregateContract`)**: Unbounded server-side historical rollups (`schools/{schoolId}/analytics/{periodId}`, `clubs/{clubId}/analytics/{periodId}`, `events/{eventId}/analytics/{periodId}`), daily RSVP growth curves, scheduled club follower snapshots, and authenticated event view/bookmark telemetry.


