# School Onboarding Guide

This guide describes how to provision, validate, and launch a real school on OnePlace without weakening tenant isolation or security rules.

---

## 1. Prerequisites

Before onboarding a school, confirm:

1. **School Identifier (`schoolId`)**: Lowercase URL-safe slug (for example, `lincoln-high`, matching `^[a-zA-Z0-9_-]{2,128}$`).
2. **Official School Profile**: Official name, canonical IANA timezone (e.g., `America/Los_Angeles`), campus city/state, activities contact name/email, and optional HTTPS logo/cover URLs.
3. **Designated First School Administrator**: A verified Google account belonging to an authorized staff member or faculty advisor. OnePlace intentionally does not allow self-service admin registration.
4. **Domain / Routing Decision**:
   - **Single-school deployment**: Set `VITE_SCHOOL_ID`, `VITE_SCHOOL_NAME`, and `VITE_SCHOOL_TIMEZONE` in Netlify environment variables.
   - **Multi-school deployment**: Configure `VITE_SCHOOL_DOMAIN_MAP` (JSON mapping hostname → `schoolId`, e.g., `{"lincoln.oneplace.app":"lincoln-high"}`) and add each custom domain to **Firebase Console → Authentication → Settings → Authorized domains**.
   - **Controlled staging preview**: Optionally list preview school IDs in `VITE_ALLOWED_QUERY_SCHOOLS` so `?school=<schoolId>` resolves safely without permitting arbitrary school IDs.

---

## 2. Provisioning the First School Administrator

Because the bootstrapped root admin shortcut in `firestore.rules` is strictly scoped to `oakridge-high`, every additional school provisions its first administrator directly in Firebase Console (never via client self-signup):

1. Have the designated school administrator sign into OnePlace once with Google, open the **Profile** tab, expand **Need organizer access? Show account support ID**, and share their Firebase UID.
2. In Firebase Console → Cloud Firestore (`ai-studio-7ee14d70-ac45-4044-ba7c-16d294924f7c`), create:
   - `/schools/{schoolId}` with `id`, `name`, `slug`, `timezone`, `status: "pending_setup"`, `allowPublicDiscovery: true`, `pilotStage: "internal_validation"`, `updatedAt` (timestamp), `updatedBy` (admin UID).
   - `/schools/{schoolId}/members/{adminUid}` with `uid`, `schoolId`, `role: "admin"`, `status: "active"`, `displayName`, `email`, `createdAt`, `updatedAt`.
   - `/userMemberships/{adminUid}` with `uid`, `schoolId`, `role: "admin"`, `status: "active"`, `updatedAt`.
3. Once that first administrator signs in, they can manage all remaining school setup directly inside **Organizer Studio → Settings** and **Launch**.

---

## 3. Completing the 10-Step School Onboarding Workflow

Inside **Organizer Studio → Launch**, work through the 10 tracked milestones:

1. **Configure school profile**: Confirm school name, contact details, and campus description.
2. **Confirm school timezone**: Verify canonical IANA timezone so every event formats consistently.
3. **Add school branding & campus details**: Add campus location, description, and optional HTTPS logo/cover image.
4. **Provision school administrator**: Verified active administrator account.
5. **Register initial campus clubs**: Create clubs manually or via **Settings → Controlled CSV Campus Data Import (Clubs CSV)**.
6. **Assign authorized club organizers**: Assign club leads by Firebase UID in **Settings → Club Organizer & Member Roles**, then scope each organizer to their specific club under **Clubs**.
7. **Create or import initial events**: Import real schedules via **Events CSV** (defaulting to `Draft` so admins can inspect dates/rooms before publishing) or create events in **My Events**.
8. **Verify visibility, permissions & privacy**: Confirm public vs. school-only visibility and test that an organizer can only edit their assigned club.
9. **Complete launch readiness review**: Review the Launch Readiness Gate table, backup export, and incident response steps.
10. **Activate student access**: Switch school status from `Pending Setup` to `Active` (requires explicit admin confirmation).

---

## 4. Controlled 4-Stage Pilot Rollout

Never invite an entire student body before completing internal permission validation:

- **Stage 1 — Internal Validation**: Admins + 2–3 trusted club organizers test create, publish, edit, cancel, and cross-club isolation.
- **Stage 2 — Student Trial**: Invite 15–30 pilot students to test mobile browsing, RSVPs, club following, and submit candid feedback via **Send Feedback**.
- **Stage 3 — Club Expansion**: Import remaining active school clubs via CSV and onboard student club officers.
- **Stage 4 — School-Wide Release**: Set school status to `Active`, announce the campus URL, and establish a recurring manual JSON backup cadence (or automated exports if upgraded to Blaze).
