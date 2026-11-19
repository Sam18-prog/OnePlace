# Incident Response Playbook

Use this playbook when investigating operational, authentication, permission, or content incidents in OnePlace.

---

## 1. Severity Classification

- **SEV-1 (Critical)**: Unauthorized cross-school data access, unintended admin escalation, or complete site outage.
- **SEV-2 (High)**: Google Sign-In failures across all users, Firestore quota exhaustion, or RSVP writes failing globally.
- **SEV-3 (Medium)**: Single club/organizer permission issue, malformed event schedule, or UI layout defect on a specific device.

---

## 2. Common Incident Runbooks

### A. Google Sign-In Fails (`auth/unauthorized-domain` or Popup Blocked)
1. Confirm the live hostname (e.g., `oneplace4all.netlify.app` or a new custom school domain) is listed under **Firebase Console → Authentication → Settings → Authorized domains**.
2. Verify `netlify.toml` keeps `Cross-Origin-Opener-Policy: same-origin-allow-popups` so Google OAuth popups can communicate back to the opener window.
3. Ask affected students to retry outside embedded in-app browsers (such as Instagram/TikTok webviews) using Safari or Chrome.

### B. Unexpected `permission-denied` Firestore Errors
1. Check whether the user's Google account has `emailVerified === true`. Unverified accounts are intentionally blocked from write operations.
2. Verify the user's membership status under **Settings → Club Organizer & Member Roles** (`active` vs. `suspended`).
3. For organizer edits, confirm the organizer is assigned to the target club under **Clubs → Manage Organizers** and that the club status is `active`.
4. Confirm the latest `firestore.rules` passed `npx eslint firestore.rules` and was deployed to `thermal-surface-rgt36`.

### C. Inappropriate or Incorrect Published Event / Club Content
1. **Immediate Mitigation**: A School Administrator opens **Organizer Studio → My Events** and soft-cancels the event (with a neutral reason) or updates the club status to `suspended` under **Clubs**.
2. **Account Containment**: If posted by a compromised or abusive organizer account, immediately set that member's status to `suspended` under **Settings → Club Organizer & Member Roles** and revoke their club assignment.
3. **Preserve Evidence**: Export a JSON backup snapshot from **Settings** before making additional cleanup edits.

### D. School-Wide Maintenance or Pilot Pause
1. Open **Organizer Studio → Launch** (or **Settings → School Configuration**).
2. Switch school status to `Suspended` and confirm the status change. Visitors will immediately see the maintenance banner.

### E. Firestore Free-Tier Quota Exceeded
1. Symptoms: Firestore returns `Quota exceeded` or `resource-exhausted` errors.
2. Short-term: Pause bulk CSV imports or migration runs; Spark/Starter daily quotas reset the next day.
3. Long-term: Review read/write spikes and upgrade the Firebase project to Blaze before full school-wide rollout if daily active usage approaches free-tier thresholds.

### F. Frontend Regression After Deployment
1. In Netlify Dashboard → **Deploys**, select the last known-good production deploy and click **Publish deploy** for immediate rollback.
2. Reproduce locally with `npm run build` and `npx --yes tsx --test src/utils/*.test.ts` before pushing a fix.
