import type { PilotStage, SchoolOnboardingChecklist, SchoolStatus } from '../types/school';

const rawSchoolId =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SCHOOL_ID) || 'oakridge-high';
const rawSchoolName =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SCHOOL_NAME) ||
  'Oakridge High School';
const rawSchoolTimezone =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SCHOOL_TIMEZONE) ||
  'America/Los_Angeles';

export const DEFAULT_SCHOOL_ID = rawSchoolId.trim() || 'oakridge-high';
export const DEFAULT_SCHOOL_NAME = rawSchoolName.trim() || 'Oakridge High School';
export const DEFAULT_SCHOOL_TIMEZONE = rawSchoolTimezone.trim() || 'America/Los_Angeles';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'sameerkunwar995@gmail.com';

export const SUPPORTED_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'UTC',
] as const;

export interface SchoolConfig {
  id: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  description?: string;
  location?: string;
  timezone: string;
  contactEmail?: string;
  contactName?: string;
  status: SchoolStatus;
  allowPublicDiscovery: boolean;
  pilotStage?: PilotStage;
  onboardingChecklist?: SchoolOnboardingChecklist;
  createdAt?: Date;
  updatedAt?: Date;
}
