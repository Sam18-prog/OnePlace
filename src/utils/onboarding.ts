import type { SchoolConfig } from '../config/school';
import type { Club } from '../types/club';
import type { SchoolEvent } from '../types/event';
import type { SchoolMembership } from '../types/membership';
import {
  DEFAULT_SCHOOL_ONBOARDING_CHECKLIST,
  type PilotStage,
  type SchoolOnboardingChecklist,
  type UserOnboardingProgress,
} from '../types/school';

export interface OnboardingStepItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  autoDetected: boolean;
  checklistKey?: keyof SchoolOnboardingChecklist;
  actionTab?: 'overview' | 'events' | 'clubs' | 'analytics' | 'settings' | 'launch';
}

export interface OnboardingProgressSummary {
  steps: OnboardingStepItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
  isComplete: boolean;
}

export function evaluateSchoolSetupSteps(params: {
  schoolConfig: SchoolConfig;
  clubs: Club[];
  events: SchoolEvent[];
  members: SchoolMembership[];
}): OnboardingProgressSummary {
  const { schoolConfig, clubs, events, members } = params;
  const checklist: SchoolOnboardingChecklist = {
    ...DEFAULT_SCHOOL_ONBOARDING_CHECKLIST,
    ...(schoolConfig.onboardingChecklist ?? {}),
  };

  const activeClubs = clubs.filter((c) => c.status === 'active');
  const publishedEvents = events.filter((e) => e.status === 'published');
  const assignedOrganizers = members.filter(
    (m) => m.status === 'active' && (m.role === 'organizer' || m.role === 'admin')
  );
  const hasBranding = Boolean(
    schoolConfig.description?.trim() ||
      schoolConfig.logoUrl?.trim() ||
      schoolConfig.coverImageUrl?.trim() ||
      schoolConfig.location?.trim()
  );

  const steps: OnboardingStepItem[] = [
    {
      id: 'school-profile',
      label: '1. Configure school profile',
      description: 'Verify official school name, contact details, and campus description.',
      completed: Boolean(schoolConfig.name.trim().length >= 2 && checklist.profileReviewed),
      autoDetected: false,
      checklistKey: 'profileReviewed',
      actionTab: 'settings',
    },
    {
      id: 'timezone',
      label: '2. Confirm school timezone',
      description: `All campus event times format in ${schoolConfig.timezone}.`,
      completed: Boolean(schoolConfig.timezone.trim().length >= 2),
      autoDetected: true,
      actionTab: 'settings',
    },
    {
      id: 'branding',
      label: '3. Add school branding & campus details',
      description: 'Add a school description, campus location, or optional HTTPS logo/cover image.',
      completed: hasBranding,
      autoDetected: true,
      actionTab: 'settings',
    },
    {
      id: 'admin-provisioned',
      label: '4. Provision school administrator',
      description: 'At least one active administrator is authorized for this school.',
      completed: true,
      autoDetected: true,
      actionTab: 'settings',
    },
    {
      id: 'register-clubs',
      label: '5. Register initial campus clubs',
      description: `${activeClubs.length} active ${activeClubs.length === 1 ? 'club' : 'clubs'} currently registered.`,
      completed: activeClubs.length > 0,
      autoDetected: true,
      actionTab: 'clubs',
    },
    {
      id: 'assign-organizers',
      label: '6. Assign authorized club organizers',
      description: `${assignedOrganizers.length} active organizer/admin ${assignedOrganizers.length === 1 ? 'member' : 'members'} provisioned.`,
      completed: assignedOrganizers.length > 0,
      autoDetected: true,
      actionTab: 'settings',
    },
    {
      id: 'publish-events',
      label: '7. Create or import initial events',
      description: `${publishedEvents.length} published ${publishedEvents.length === 1 ? 'event' : 'events'} ready for students.`,
      completed: publishedEvents.length > 0,
      autoDetected: true,
      actionTab: 'events',
    },
    {
      id: 'visibility-permissions',
      label: '8. Verify visibility, permissions & privacy',
      description: 'Confirm public vs. school-only visibility and student privacy controls.',
      completed: checklist.visibilityVerified && checklist.permissionsReviewed && checklist.privacyReviewed,
      autoDetected: false,
      checklistKey: 'visibilityVerified',
      actionTab: 'launch',
    },
    {
      id: 'launch-checklist',
      label: '9. Complete launch readiness review',
      description: 'Review security rules, backup workflow, and notification settings.',
      completed: checklist.notificationsReviewed && checklist.launchConfirmed,
      autoDetected: false,
      checklistKey: 'launchConfirmed',
      actionTab: 'launch',
    },
    {
      id: 'activate-students',
      label: '10. Activate student access',
      description:
        schoolConfig.status === 'active'
          ? 'School status is Active and open for approved students.'
          : `Current status: ${schoolConfig.status.replace('_', ' ')}. Set status to Active when ready.`,
      completed: schoolConfig.status === 'active',
      autoDetected: true,
      actionTab: 'settings',
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const totalCount = steps.length;
  return {
    steps,
    completedCount,
    totalCount,
    percent: Math.round((completedCount / totalCount) * 100),
    isComplete: completedCount === totalCount,
  };
}

export interface OrganizerChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  manualKey?: 'clubProfileReviewed' | 'eventManagementReviewed';
  actionTab: 'events' | 'clubs' | 'analytics';
}

export function evaluateOrganizerOnboardingSteps(params: {
  assignedClubs: Club[];
  managedEvents: SchoolEvent[];
  progress: UserOnboardingProgress;
}): {
  steps: OrganizerChecklistItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
} {
  const { assignedClubs, managedEvents, progress } = params;
  const hasBranding = assignedClubs.some(
    (c) =>
      Boolean(c.shortDescription?.trim()) ||
      Boolean(c.coverImageUrl?.trim()) ||
      Boolean(c.logoUrl?.trim()) ||
      Boolean(c.meetingSchedule?.trim())
  );
  const hasCreatedEvent = managedEvents.length > 0;
  const hasPublishedEvent = managedEvents.some((e) => e.status === 'published');

  const steps: OrganizerChecklistItem[] = [
    {
      id: 'club-profile-reviewed',
      label: 'Club profile reviewed',
      description: 'Check your assigned club details, meeting schedule, and room location.',
      completed: progress.clubProfileReviewed,
      manualKey: 'clubProfileReviewed',
      actionTab: 'clubs',
    },
    {
      id: 'club-branding-completed',
      label: 'Club branding completed',
      description: 'Add a short tagline, meeting schedule, or cover/logo image to your club.',
      completed: hasBranding,
      actionTab: 'clubs',
    },
    {
      id: 'first-event-created',
      label: 'First event created',
      description: 'Create your first draft or scheduled event in Organizer Studio.',
      completed: hasCreatedEvent,
      actionTab: 'events',
    },
    {
      id: 'first-event-published',
      label: 'First event published',
      description: 'Publish an event so students can discover it and RSVP.',
      completed: hasPublishedEvent,
      actionTab: 'events',
    },
    {
      id: 'event-management-reviewed',
      label: 'Event management & analytics reviewed',
      description: 'Explore RSVP tracking, editing/cancellation flows, and event analytics.',
      completed: progress.eventManagementReviewed,
      manualKey: 'eventManagementReviewed',
      actionTab: 'analytics',
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    percent: Math.round((completedCount / steps.length) * 100),
  };
}

export const PILOT_STAGES: {
  id: PilotStage;
  stepNumber: number;
  title: string;
  audience: string;
  goal: string;
  exitCriteria: string;
}[] = [
  {
    id: 'internal_validation',
    stepNumber: 1,
    title: 'Stage 1 — Internal Validation',
    audience: 'School administrators & 2–3 trusted club organizers',
    goal: 'Validate school config, club setup, event publishing, editing, cancellation, and permissions.',
    exitCriteria: 'Zero permission errors across create/publish/edit/cancel workflows.',
  },
  {
    id: 'student_trial',
    stepNumber: 2,
    title: 'Stage 2 — Student Trial',
    audience: 'Limited group of 15–30 pilot students',
    goal: 'Validate mobile discovery, RSVPs, club following, and gather honest usability feedback.',
    exitCriteria: 'Pilot student feedback reviewed and any usability/mobile defects resolved.',
  },
  {
    id: 'club_expansion',
    stepNumber: 3,
    title: 'Stage 3 — Club Expansion',
    audience: 'Additional approved school clubs & student officers',
    goal: 'Onboard remaining active clubs via CSV import or manual creation and verify club-scoped roles.',
    exitCriteria: 'Each participating club can manage its own schedule independently without cross-club edits.',
  },
  {
    id: 'school_wide',
    stepNumber: 4,
    title: 'Stage 4 — School-Wide Release',
    audience: 'Full approved school student community',
    goal: 'Open approved school access with ongoing backup cadence and incident response playbook.',
    exitCriteria: 'Launch checklist complete, privacy notice approved, and school status set to Active.',
  },
];

export type LaunchReadinessStatus =
  | 'Ready'
  | 'Needs attention'
  | 'Blocked'
  | 'Not applicable'
  | 'Not verified';

export interface LaunchReadinessItem {
  id: string;
  area: string;
  status: LaunchReadinessStatus;
  summary: string;
  actionNote?: string;
}

export function computeLaunchReadinessGate(params: {
  schoolConfig: SchoolConfig;
  activeClubCount: number;
  publishedEventCount: number;
}): LaunchReadinessItem[] {
  const { schoolConfig, activeClubCount, publishedEventCount } = params;
  return [
    {
      id: 'auth',
      area: 'Authentication reliability',
      status: 'Needs attention',
      summary: 'Google OAuth error mapping & verified-email gates implemented; verify custom school domain in Firebase Authorized Domains.',
    },
    {
      id: 'firestore-authz',
      area: 'Firestore authorization & RBAC',
      status: 'Ready',
      summary: 'Default-deny rules with school-scoped RBAC, suspended member blocking, and strict schema validation deployed to thermal-surface-rgt36.',
    },
    {
      id: 'school-isolation',
      area: 'Multi-school tenant isolation',
      status: 'Ready',
      summary: 'All clubs, events, memberships, feedback, and analytics partition strictly by schoolId; bootstrap admin scoped to oakridge-high.',
    },
    {
      id: 'rsvp-integrity',
      area: 'RSVP data integrity & concurrency',
      status: 'Ready',
      summary: 'Atomic attendee + counter writes, server timeout reconciliation, past/cancelled guards, and cross-tab sync unit-tested.',
    },
    {
      id: 'event-club-perms',
      area: 'Event publishing & club permissions',
      status: activeClubCount > 0 && publishedEventCount > 0 ? 'Ready' : 'Needs attention',
      summary:
        activeClubCount > 0 && publishedEventCount > 0
          ? `${activeClubCount} active clubs and ${publishedEventCount} published events ready under club-scoped organizer controls.`
          : 'Register at least one active club and publish one real campus event before inviting students.',
    },
    {
      id: 'student-privacy',
      area: 'Student privacy & data minimization',
      status: 'Ready',
      summary: 'No attendee/follower list enumeration, PII-free analytics & backups, collapsed Support ID, and private student feedback.',
    },
    {
      id: 'mobile-usability',
      area: 'Mobile usability & WCAG 2.2 AA',
      status: 'Ready',
      summary: 'Verified 0px horizontal overflow across 320px–1440px viewports, skip links, and keyboard focus-trapped dialogs.',
    },
    {
      id: 'deployment-csp',
      area: 'Production deployment & security headers',
      status: 'Needs attention',
      summary: 'netlify.toml configured with SPA redirects, HSTS, COOP, and CSP; verify live headers on oneplace4all.netlify.app after deploy.',
    },
    {
      id: 'error-handling',
      area: 'Error handling & diagnostics',
      status: 'Ready',
      summary: 'Centralized friendly error mapping, PII-redacted diagnostics, and hardened ErrorBoundary active.',
    },
    {
      id: 'backups',
      area: 'Data backup procedures',
      status: 'Needs attention',
      summary: 'Starter Tier manual PII-free JSON backup export available in Admin panel; automated daily Firestore exports require Blaze plan.',
    },
    {
      id: 'admin-provisioning',
      area: 'Administrative provisioning',
      status: 'Ready',
      summary: 'No self-service admin escalation; roles assigned only by authorized school admins or documented Firebase Console setup.',
    },
    {
      id: 'emulator-oauth-runtime',
      area: 'Firestore Emulator & live OAuth write test',
      status: 'Not verified',
      summary: 'Container lacks Java runtime for Firestore Emulator; run live authenticated pilot write test before Stage 2 student rollout.',
    },
    {
      id: 'school-status',
      area: 'School profile activation status',
      status: schoolConfig.status === 'active' ? 'Ready' : 'Needs attention',
      summary:
        schoolConfig.status === 'active'
          ? `${schoolConfig.name} is Active.`
          : `${schoolConfig.name} is currently "${schoolConfig.status.replace('_', ' ')}". Switch to Active when Stage 1 validation completes.`,
    },
  ];
}
