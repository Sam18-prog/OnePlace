import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLaunchReadinessGate,
  evaluateOrganizerOnboardingSteps,
  evaluateSchoolSetupSteps,
} from './onboarding';
import { resolveActiveSchoolId } from './schoolContext';
import type { SchoolConfig } from '../config/school';
import { DEFAULT_USER_ONBOARDING_PROGRESS } from '../types/school';

const BASE_SCHOOL: SchoolConfig = {
  id: 'oakridge-high',
  name: 'Oakridge High School',
  timezone: 'America/Los_Angeles',
  status: 'pending_setup',
  allowPublicDiscovery: true,
};

test('evaluateSchoolSetupSteps accurately calculates 10-step school onboarding completion', () => {
  const initial = evaluateSchoolSetupSteps({
    schoolConfig: BASE_SCHOOL,
    clubs: [],
    events: [],
    members: [],
  });

  assert.equal(initial.totalCount, 10);
  // Timezone + admin provisioned are auto-detected
  assert.equal(initial.completedCount, 2);
  assert.equal(initial.isComplete, false);

  const completed = evaluateSchoolSetupSteps({
    schoolConfig: {
      ...BASE_SCHOOL,
      status: 'active',
      description: 'Official campus hub for Oakridge High School.',
      onboardingChecklist: {
        profileReviewed: true,
        visibilityVerified: true,
        permissionsReviewed: true,
        privacyReviewed: true,
        notificationsReviewed: true,
        launchConfirmed: true,
      },
    },
    clubs: [
      {
        id: 'robotics',
        schoolId: 'oakridge-high',
        name: 'Robotics Club',
        slug: 'robotics',
        description: 'Engineering and robots.',
        category: 'Robotics & Engineering',
        visibility: 'public',
        status: 'active',
        isOfficial: true,
        discoverKey: 'public:oakridge-high',
        followerCount: 0,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastActivityAt: new Date(),
      },
    ],
    events: [
      {
        id: 'e1',
        schoolId: 'oakridge-high',
        title: 'Kickoff',
        description: 'Welcome meeting for all students.',
        hostClub: 'Robotics Club',
        clubId: 'robotics',
        category: 'STEM & Makers',
        dateTime: new Date(),
        startAt: new Date(),
        endAt: new Date(Date.now() + 3600000),
        timezone: 'America/Los_Angeles',
        location: 'Lab 104',
        status: 'published',
        visibility: 'public',
        discoverKey: 'public:oakridge-high',
        rsvpCount: 0,
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    members: [
      {
        uid: 'org-1',
        schoolId: 'oakridge-high',
        role: 'organizer',
        status: 'active',
        createdAt: new Date(),
      },
    ],
  });

  assert.equal(completed.completedCount, 10);
  assert.equal(completed.percent, 100);
  assert.equal(completed.isComplete, true);
});

test('evaluateOrganizerOnboardingSteps combines live club/event state with persisted checklist items', () => {
  const progress = {
    ...DEFAULT_USER_ONBOARDING_PROGRESS('org-1', 'oakridge-high'),
    clubProfileReviewed: true,
  };
  const result = evaluateOrganizerOnboardingSteps({
    assignedClubs: [],
    managedEvents: [],
    progress,
  });

  assert.equal(result.totalCount, 5);
  assert.equal(result.completedCount, 1);
  assert.equal(result.percent, 20);
});

test('computeLaunchReadinessGate honestly flags unverified emulator/OAuth items and pending school status', () => {
  const gate = computeLaunchReadinessGate({
    schoolConfig: BASE_SCHOOL,
    activeClubCount: 0,
    publishedEventCount: 0,
  });

  assert.ok(gate.some((item) => item.id === 'emulator-oauth-runtime' && item.status === 'Not verified'));
  assert.ok(gate.some((item) => item.id === 'school-status' && item.status === 'Needs attention'));
});

test('resolveActiveSchoolId maps configured hostnames, blocks unallowlisted query overrides, and falls back safely', () => {
  const domainMap = JSON.stringify({
    'oakridge.oneplace.edu': 'oakridge-high',
    'westview.oneplace.edu': 'westview-high',
  });

  assert.equal(
    resolveActiveSchoolId({
      hostname: 'westview.oneplace.edu',
      domainMapJson: domainMap,
      fallbackSchoolId: 'oakridge-high',
    }),
    'westview-high'
  );

  // Arbitrary ?school= override is ignored when not explicitly allowlisted
  assert.equal(
    resolveActiveSchoolId({
      hostname: 'oneplace4all.netlify.app',
      search: '?school=unauthorized-tenant',
      fallbackSchoolId: 'oakridge-high',
    }),
    'oakridge-high'
  );

  // Explicitly allowlisted pilot preview ?school= works
  assert.equal(
    resolveActiveSchoolId({
      hostname: 'oneplace4all.netlify.app',
      search: '?school=westview-high',
      allowedQuerySchoolsCsv: 'oakridge-high,westview-high',
      fallbackSchoolId: 'oakridge-high',
    }),
    'westview-high'
  );
});
