import type { EventCategory } from '../types/event';

export interface EventMediaAsset {
  src: string;
  alt: string;
  fallbackLabel: string;
}

const EVENT_MEDIA_BY_ID: Record<string, EventMediaAsset> = {
  'evt-robotics-build': {
    src: '/src/assets/images/event_robotics_build_1794978939367.jpg',
    alt: 'Students collaborating around an aluminum competition robot in the engineering lab',
    fallbackLabel: 'Engineering Lab',
  },
  'evt-student-council': {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: 'Students gathered around a sunlit oak table in the student union commons',
    fallbackLabel: 'Student Union',
  },
  'evt-varsity-hoops': {
    src: '/src/assets/images/event_varsity_hoops_1794978939544.jpg',
    alt: 'Hardwood basketball court inside the main school gymnasium',
    fallbackLabel: 'Main Gymnasium',
  },
  'evt-debate-trial': {
    src: '/src/assets/images/event_debate_session_1794978941272.jpg',
    alt: 'Students preparing printed debate briefs in a sunlit humanities seminar room',
    fallbackLabel: 'Humanities Seminar',
  },
  'evt-jazz-coffeehouse': {
    src: '/src/assets/images/event_jazz_coffeehouse_1794978942245.jpg',
    alt: 'Acoustic guitar and saxophone on stage under warm string lights in the black box theater',
    fallbackLabel: 'Black Box Theater',
  },
  'evt-winter-hackathon': {
    src: '/src/assets/images/event_winter_hackathon_1794978942359.jpg',
    alt: 'Students brainstorming software prototypes with laptops and sticky notes in the media center',
    fallbackLabel: 'Media Center',
  },
};

const CATEGORY_FALLBACK_MEDIA: Record<EventCategory, EventMediaAsset> = {
  'STEM & Makers': {
    src: '/src/assets/images/event_robotics_build_1794978939367.jpg',
    alt: 'STEM and Makers campus event cover',
    fallbackLabel: 'STEM & Makers',
  },
  Leadership: {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: 'Student leadership campus event cover',
    fallbackLabel: 'Leadership',
  },
  Athletics: {
    src: '/src/assets/images/event_varsity_hoops_1794978939544.jpg',
    alt: 'Campus athletics event cover',
    fallbackLabel: 'Athletics',
  },
  Academic: {
    src: '/src/assets/images/event_debate_session_1794978941272.jpg',
    alt: 'Academic seminar campus event cover',
    fallbackLabel: 'Academic',
  },
  'Arts & Music': {
    src: '/src/assets/images/event_jazz_coffeehouse_1794978942245.jpg',
    alt: 'Campus arts and music event cover',
    fallbackLabel: 'Arts & Music',
  },
  'Social & Community': {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: 'Campus social and community gathering cover',
    fallbackLabel: 'Social & Community',
  },
};

export function isSafeMediaUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function getEventMedia(
  eventId: string,
  category: EventCategory,
  dynamicImageUrl?: string,
  eventTitle?: string
): EventMediaAsset {
  if (isSafeMediaUrl(dynamicImageUrl)) {
    return {
      src: dynamicImageUrl.trim(),
      alt: eventTitle ? `${eventTitle} cover image` : `${category} event cover`,
      fallbackLabel: category,
    };
  }
  if (EVENT_MEDIA_BY_ID[eventId]) {
    return EVENT_MEDIA_BY_ID[eventId];
  }
  return CATEGORY_FALLBACK_MEDIA[category];
}
