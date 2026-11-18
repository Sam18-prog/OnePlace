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

export function getEventMedia(eventId: string, category: EventCategory): EventMediaAsset {
  if (EVENT_MEDIA_BY_ID[eventId]) {
    return EVENT_MEDIA_BY_ID[eventId];
  }
  return {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: `${category} campus event cover`,
    fallbackLabel: category,
  };
}
