import { SUPPORTED_TIMEZONES } from '../config/school';
import type { Club, ClubCategory, ClubFormValues, ClubVisibility } from '../types/club';
import type { EventCategory, EventFormValues, EventVisibility, SchoolEvent } from '../types/event';
import { ALL_CLUB_CATEGORIES, isValidClubCategory, slugifyClubName } from './clubValidation';
import { isSafeMediaUrl } from './eventMedia';
import { ALL_EVENT_CATEGORIES } from './eventValidation';

export interface ParsedCsvRow {
  rowNumber: number;
  raw: Record<string, string>;
}

/**
 * Minimal RFC-4180 CSV parser supporting quoted fields, embedded commas, escaped quotes (""),
 * CRLF/LF line breaks, and UTF-8 BOM stripping.
 */
export function parseCsvText(csvText: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  const matrix: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field.trim());
      matrix.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(field.trim());
      matrix.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    matrix.push(row);
  }

  const nonEmpty = matrix.filter((r) => r.some((cell) => cell.length > 0));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = nonEmpty[0].map((h) => h.trim());
  const rows: ParsedCsvRow[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const cells = nonEmpty[i];
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (header) {
        record[header.toLowerCase()] = (cells[idx] ?? '').trim();
      }
    });
    rows.push({
      rowNumber: i + 1,
      raw: record,
    });
  }

  return { headers, rows };
}

export interface ValidatedEventImportRow {
  rowNumber: number;
  status: 'valid' | 'duplicate' | 'error';
  errors: string[];
  warnings: string[];
  resolvedClubId?: string;
  resolvedClubName?: string;
  timezone: string;
  values?: EventFormValues;
  rawTitle: string;
  rawClub: string;
  rawDate: string;
}

export interface EventCsvImportSummary {
  totalRows: number;
  validRows: ValidatedEventImportRow[];
  duplicateRows: ValidatedEventImportRow[];
  errorRows: ValidatedEventImportRow[];
  allRows: ValidatedEventImportRow[];
}

function normalizeTextKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseBooleanCell(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === 'yes' || v === '1') return true;
  if (v === 'false' || v === 'no' || v === '0') return false;
  return fallback;
}

function isValidDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidTimeString(timeStr: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return false;
  const [h, m] = timeStr.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function formatDateKeyInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    return `${y}-${m}-${d}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function validateEventCsvImport(params: {
  csvText: string;
  existingClubs: Club[];
  existingEvents: SchoolEvent[];
  schoolTimezone: string;
}): EventCsvImportSummary {
  const { csvText, existingClubs, existingEvents, schoolTimezone } = params;
  const { rows } = parseCsvText(csvText);

  const clubById = new Map<string, Club>();
  const clubByName = new Map<string, Club>();
  for (const club of existingClubs) {
    clubById.set(club.id.toLowerCase(), club);
    clubByName.set(normalizeTextKey(club.name), club);
  }

  const existingFingerprints = new Set<string>();
  for (const evt of existingEvents) {
    const dateKey = formatDateKeyInTimezone(evt.startAt, evt.timezone || schoolTimezone);
    existingFingerprints.add(
      `${normalizeTextKey(evt.title)}|${evt.clubId.toLowerCase()}|${dateKey}`
    );
  }
  const seenInBatch = new Set<string>();

  const allRows: ValidatedEventImportRow[] = rows.map(({ rowNumber, raw }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const title = (raw.title || '').trim();
    const description = (raw.description || '').trim();
    const clubIdInput = (raw.clubid || raw['club_id'] || '').trim();
    const clubNameInput = (raw.clubname || raw['club_name'] || raw.hostclub || '').trim();
    const categoryInput = (raw.category || '').trim();
    const dateInput = (raw.date || raw.eventdate || '').trim();
    const startTime = (raw.starttime || raw['start_time'] || '').trim();
    const endTime = (raw.endtime || raw['end_time'] || '').trim();
    const tzInput = (raw.timezone || '').trim();
    const location = (raw.location || '').trim();
    const imageUrl = (raw.imageurl || raw['image_url'] || '').trim();
    const visibilityInput = (raw.visibility || 'public').trim().toLowerCase();

    if (title.length < 3 || title.length > 120) {
      errors.push('Title must be between 3 and 120 characters.');
    }
    if (description.length < 10 || description.length > 1000) {
      errors.push('Description must be between 10 and 1,000 characters.');
    }
    if (location.length < 2 || location.length > 120) {
      errors.push('Location must be between 2 and 120 characters.');
    }

    // Resolve club
    const matchedClub =
      (clubIdInput ? clubById.get(clubIdInput.toLowerCase()) : undefined) ??
      (clubNameInput ? clubByName.get(normalizeTextKey(clubNameInput)) : undefined);

    if (!matchedClub) {
      errors.push(
        `Missing club: "${clubIdInput || clubNameInput || '(blank)'}" is not registered in this school.`
      );
    } else if (matchedClub.status !== 'active') {
      errors.push(`Club "${matchedClub.name}" is suspended and cannot host imported events.`);
    }

    // Category validation
    const matchedCategory = ALL_EVENT_CATEGORIES.find(
      (c) => c.toLowerCase() === categoryInput.toLowerCase()
    ) as EventCategory | undefined;
    if (!matchedCategory) {
      errors.push(
        `Invalid category "${categoryInput || '(blank)'}". Expected one of: ${ALL_EVENT_CATEGORIES.join(', ')}.`
      );
    }

    // Date & time validation
    if (!isValidDateString(dateInput)) {
      errors.push('Invalid date format. Use YYYY-MM-DD (e.g., 2026-10-15).');
    }
    if (!isValidTimeString(startTime)) {
      errors.push('Invalid startTime format. Use 24-hour HH:MM (e.g., 15:30).');
    }
    if (!isValidTimeString(endTime)) {
      errors.push('Invalid endTime format. Use 24-hour HH:MM (e.g., 17:00).');
    }
    if (
      isValidTimeString(startTime) &&
      isValidTimeString(endTime) &&
      timeToMinutes(endTime) <= timeToMinutes(startTime)
    ) {
      errors.push('endTime must be later than startTime.');
    }

    // Timezone validation
    let resolvedTimezone = schoolTimezone;
    if (tzInput) {
      if ((SUPPORTED_TIMEZONES as readonly string[]).includes(tzInput)) {
        resolvedTimezone = tzInput;
      } else {
        warnings.push(
          `Timezone "${tzInput}" is not in standard school timezones; defaulting to ${schoolTimezone}.`
        );
      }
    }

    // Visibility validation
    let visibility: EventVisibility = 'public';
    if (visibilityInput === 'school') {
      visibility = 'school';
    } else if (visibilityInput && visibilityInput !== 'public') {
      warnings.push(`Unknown visibility "${visibilityInput}"; defaulting to "public".`);
    }

    // Image URL safety check
    let safeImageUrl = '';
    if (imageUrl) {
      if (isSafeMediaUrl(imageUrl)) {
        safeImageUrl = imageUrl;
      } else {
        errors.push('imageUrl must be a valid https:// URL.');
      }
    }

    // Duplicate detection
    let isDuplicate = false;
    if (matchedClub && title && isValidDateString(dateInput)) {
      const fingerprint = `${normalizeTextKey(title)}|${matchedClub.id.toLowerCase()}|${dateInput}`;
      if (existingFingerprints.has(fingerprint)) {
        isDuplicate = true;
        warnings.push('Duplicate of an existing event with the same title, club, and date (will be skipped).');
      } else if (seenInBatch.has(fingerprint)) {
        isDuplicate = true;
        warnings.push('Duplicate row inside this CSV file (will be skipped).');
      } else {
        seenInBatch.add(fingerprint);
      }
    }

    if (errors.length > 0) {
      return {
        rowNumber,
        status: 'error',
        errors,
        warnings,
        resolvedClubId: matchedClub?.id,
        resolvedClubName: matchedClub?.name,
        timezone: resolvedTimezone,
        rawTitle: title || '(untitled)',
        rawClub: clubNameInput || clubIdInput || '(missing)',
        rawDate: dateInput || '(missing)',
      };
    }

    if (isDuplicate) {
      return {
        rowNumber,
        status: 'duplicate',
        errors: [],
        warnings,
        resolvedClubId: matchedClub!.id,
        resolvedClubName: matchedClub!.name,
        timezone: resolvedTimezone,
        rawTitle: title,
        rawClub: matchedClub!.name,
        rawDate: dateInput,
      };
    }

    return {
      rowNumber,
      status: 'valid',
      errors: [],
      warnings,
      resolvedClubId: matchedClub!.id,
      resolvedClubName: matchedClub!.name,
      timezone: resolvedTimezone,
      rawTitle: title,
      rawClub: matchedClub!.name,
      rawDate: dateInput,
      values: {
        title,
        hostClub: matchedClub!.name,
        clubId: matchedClub!.id,
        category: matchedCategory!,
        eventDate: dateInput,
        startTime,
        endTime,
        location,
        description,
        imageUrl: safeImageUrl,
        visibility,
      },
    };
  });

  return {
    totalRows: allRows.length,
    validRows: allRows.filter((r) => r.status === 'valid'),
    duplicateRows: allRows.filter((r) => r.status === 'duplicate'),
    errorRows: allRows.filter((r) => r.status === 'error'),
    allRows,
  };
}

export interface ValidatedClubImportRow {
  rowNumber: number;
  status: 'valid' | 'duplicate' | 'error';
  errors: string[];
  warnings: string[];
  rawName: string;
  rawCategory: string;
  values?: ClubFormValues;
}

export interface ClubCsvImportSummary {
  totalRows: number;
  validRows: ValidatedClubImportRow[];
  duplicateRows: ValidatedClubImportRow[];
  errorRows: ValidatedClubImportRow[];
  allRows: ValidatedClubImportRow[];
}

export function validateClubCsvImport(params: {
  csvText: string;
  existingClubs: Club[];
}): ClubCsvImportSummary {
  const { csvText, existingClubs } = params;
  const { rows } = parseCsvText(csvText);

  const existingSlugs = new Set(existingClubs.map((c) => c.slug.toLowerCase()));
  const existingNames = new Set(existingClubs.map((c) => normalizeTextKey(c.name)));
  const seenSlugs = new Set<string>();

  const allRows: ValidatedClubImportRow[] = rows.map(({ rowNumber, raw }) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const name = (raw.name || raw.clubname || '').trim();
    const shortDescription = (raw.shortdescription || raw['short_description'] || '').trim();
    const description = (raw.description || '').trim();
    const categoryInput = (raw.category || '').trim();
    const visibilityInput = (raw.visibility || 'public').trim().toLowerCase();
    const meetingSchedule = (raw.meetingschedule || raw['meeting_schedule'] || '').trim();
    const meetingLocation = (raw.meetinglocation || raw['meeting_location'] || '').trim();
    const contactEmail = (raw.contactemail || raw['contact_email'] || '').trim();
    const coverImageUrl = (raw.coverimageurl || raw['cover_image_url'] || '').trim();
    const logoUrl = (raw.logourl || raw['logo_url'] || '').trim();
    const isOfficial = parseBooleanCell(raw.isofficial || raw['is_official'], true);

    if (name.length < 2 || name.length > 80) {
      errors.push('Club name must be between 2 and 80 characters.');
    }
    if (description.length < 10 || description.length > 1200) {
      errors.push('Description must be between 10 and 1,200 characters.');
    }
    if (shortDescription.length > 180) {
      errors.push('shortDescription cannot exceed 180 characters.');
    }

    const matchedCategory = ALL_CLUB_CATEGORIES.find(
      (c) => c.toLowerCase() === categoryInput.toLowerCase()
    ) as ClubCategory | undefined;
    if (!matchedCategory || !isValidClubCategory(matchedCategory)) {
      errors.push(
        `Invalid category "${categoryInput || '(blank)'}". Expected one of: ${ALL_CLUB_CATEGORIES.join(', ')}.`
      );
    }

    let visibility: ClubVisibility = 'public';
    if (visibilityInput === 'school') {
      visibility = 'school';
    } else if (visibilityInput && visibilityInput !== 'public') {
      warnings.push(`Unknown visibility "${visibilityInput}"; defaulting to "public".`);
    }

    if (coverImageUrl && !isSafeMediaUrl(coverImageUrl)) {
      errors.push('coverImageUrl must be a valid https:// URL.');
    }
    if (logoUrl && !isSafeMediaUrl(logoUrl)) {
      errors.push('logoUrl must be a valid https:// URL.');
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errors.push('contactEmail is not a valid email address.');
    }

    const slug = slugifyClubName(name);
    let isDuplicate = false;
    if (name && (existingSlugs.has(slug) || existingNames.has(normalizeTextKey(name)))) {
      isDuplicate = true;
      warnings.push('Club already exists in this school (existing record preserved; row skipped).');
    } else if (name && seenSlugs.has(slug)) {
      isDuplicate = true;
      warnings.push('Duplicate club name inside this CSV file (will be skipped).');
    } else if (name) {
      seenSlugs.add(slug);
    }

    if (errors.length > 0) {
      return {
        rowNumber,
        status: 'error',
        errors,
        warnings,
        rawName: name || '(unnamed)',
        rawCategory: categoryInput || '(missing)',
      };
    }

    if (isDuplicate) {
      return {
        rowNumber,
        status: 'duplicate',
        errors: [],
        warnings,
        rawName: name,
        rawCategory: matchedCategory!,
      };
    }

    return {
      rowNumber,
      status: 'valid',
      errors: [],
      warnings,
      rawName: name,
      rawCategory: matchedCategory!,
      values: {
        name,
        slug,
        shortDescription,
        description,
        category: matchedCategory!,
        visibility,
        isOfficial,
        coverImageUrl,
        logoUrl,
        meetingSchedule,
        meetingLocation,
        contactEmail,
        announcement: '',
      },
    };
  });

  return {
    totalRows: allRows.length,
    validRows: allRows.filter((r) => r.status === 'valid'),
    duplicateRows: allRows.filter((r) => r.status === 'duplicate'),
    errorRows: allRows.filter((r) => r.status === 'error'),
    allRows,
  };
}

export const EVENTS_CSV_TEMPLATE = [
  'title,description,clubName,clubId,category,date,startTime,endTime,timezone,location,imageUrl,visibility',
  '"Fall Robotics Kickoff","Hands-on introduction to our competition robot chassis and programming team.","Robotics Club","robotics-club","STEM & Makers","2026-10-15","15:30","17:00","America/Los_Angeles","Engineering Lab 104","","public"',
].join('\n');

export const CLUBS_CSV_TEMPLATE = [
  'name,shortDescription,description,category,visibility,meetingSchedule,meetingLocation,contactEmail,coverImageUrl,logoUrl,isOfficial',
  '"Robotics Club","Design and build autonomous robots for regional events.","Student-led engineering community focused on mechanical design, electronics, and autonomous software.","Robotics & Engineering","public","Wednesdays at 3:30 PM","Engineering Lab 104","robotics@school.edu","","","true"',
].join('\n');

export function downloadCsvTemplate(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
