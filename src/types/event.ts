export type TimeframeBucket = 'today' | 'this-week' | 'later';

export type EventCategory =
  | 'STEM & Makers'
  | 'Leadership'
  | 'Athletics'
  | 'Academic'
  | 'Arts & Music'
  | 'Social & Community';

export type EventStatus = 'draft' | 'published' | 'cancelled';

export type EventVisibility = 'public' | 'school';

export type AppView =
  | 'discover'
  | 'explore'
  | 'clubs'
  | 'club-profile'
  | 'my-rsvps'
  | 'notifications'
  | 'notification-preferences'
  | 'profile'
  | 'organizer';

export interface DemoEventRaw {
  id: string;
  title: string;
  hostClub: string;
  clubId?: string;
  dateTime: string;
  endDateTime?: string;
  location: string;
  description: string;
  rsvpCount?: number;
  category?: EventCategory;
  imageUrl?: string;
  visibility?: EventVisibility;
}

export interface SchoolEvent {
  id: string;
  schoolId: string;
  title: string;
  description: string;
  hostClub: string;
  clubId: string;
  category: EventCategory;
  /** Canonical event start Date (aliased via dateTime for existing helpers/components) */
  dateTime: Date;
  startAt: Date;
  endAt: Date;
  timezone: string;
  location: string;
  imageUrl?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  status: EventStatus;
  visibility: EventVisibility;
  rsvpCount: number;
  discoverKey: string;
  isDemoSeed?: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  isLegacyRecord?: boolean;
}

export interface GroupedEvents {
  bucket: TimeframeBucket;
  label: string;
  events: SchoolEvent[];
}

export interface EventFormValues {
  title: string;
  hostClub: string;
  clubId?: string;
  category: EventCategory;
  eventDate: string; // YYYY-MM-DD in school timezone
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  description: string;
  imageUrl: string;
  visibility: EventVisibility;
}
