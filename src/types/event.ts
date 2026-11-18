export type TimeframeBucket = 'today' | 'this-week' | 'later';

export type EventCategory =
  | 'STEM & Makers'
  | 'Leadership'
  | 'Athletics'
  | 'Academic'
  | 'Arts & Music';

export type AppView = 'discover' | 'explore' | 'my-rsvps' | 'profile';

export interface DemoEventRaw {
  id: string;
  title: string;
  hostClub: string;
  dateTime: string;
  location: string;
  description: string;
  rsvpCount?: number;
  category?: EventCategory;
}

export interface SchoolEvent {
  id: string;
  title: string;
  hostClub: string;
  dateTime: Date;
  location: string;
  description: string;
  rsvpCount: number;
  category: EventCategory;
}

export interface GroupedEvents {
  bucket: TimeframeBucket;
  label: string;
  events: SchoolEvent[];
}
