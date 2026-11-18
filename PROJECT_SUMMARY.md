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

- **Unit Tests (`npx --yes tsx --test src/utils/events.test.ts src/utils/rsvp.test.ts`)**: **11 / 11 passing** (chronological sorting, timeframe bucketing, filtering, date formatting, `.ics` & Google Calendar URL encoding, optimistic RSVP math, and 5s timeout resolution/rejection).
- **Build & Typecheck**: `npm run build` (`vite build`) and `npm run lint` (`tsc --noEmit`) pass with zero errors.
- **Firestore Rules**: Validated with ESLint security-rules plugin and deployed to `ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`.
- **Headless Browser Verification (`playwright-cli`)**: Verified desktop (`1440×900`) and mobile (`390×844`) rendering, `SignInPromptModal` open/cancel flow, search + timeframe filtering, and 0 console errors/warnings. *(Live Google Sign-In popup auth and authenticated Firestore writes were not executed inside headless Chromium.)*
