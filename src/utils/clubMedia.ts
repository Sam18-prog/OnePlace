import type { ClubCategory } from '../types/club';
import { isSafeMediaUrl } from './eventMedia';

export interface ClubMediaAsset {
  src: string;
  alt: string;
  fallbackLabel: string;
}

const CLUB_CATEGORY_COVER_MEDIA: Record<ClubCategory, ClubMediaAsset> = {
  'Technology & Computing': {
    src: '/src/assets/images/event_winter_hackathon_1794978942359.jpg',
    alt: 'Students collaborating with laptops on software projects in the media center',
    fallbackLabel: 'Technology & Computing',
  },
  'Robotics & Engineering': {
    src: '/src/assets/images/event_robotics_build_1794978939367.jpg',
    alt: 'Students assembling an aluminum competition robot in the engineering lab',
    fallbackLabel: 'Robotics & Engineering',
  },
  'Arts & Music': {
    src: '/src/assets/images/event_jazz_coffeehouse_1794978942245.jpg',
    alt: 'Acoustic instruments on stage under warm theater lights',
    fallbackLabel: 'Arts & Music',
  },
  'Sports & Athletics': {
    src: '/src/assets/images/event_varsity_hoops_1794978939544.jpg',
    alt: 'Hardwood basketball court inside the main campus gymnasium',
    fallbackLabel: 'Sports & Athletics',
  },
  'Leadership & Student Government': {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: 'Student leaders gathered around a sunlit oak commons table',
    fallbackLabel: 'Leadership & Student Government',
  },
  'Academic & Research': {
    src: '/src/assets/images/event_debate_session_1794978941272.jpg',
    alt: 'Students preparing academic briefs in a humanities seminar room',
    fallbackLabel: 'Academic & Research',
  },
  'Culture & Community': {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: 'Students gathered in the sunlit student union commons',
    fallbackLabel: 'Culture & Community',
  },
  Entrepreneurship: {
    src: '/src/assets/images/event_winter_hackathon_1794978942359.jpg',
    alt: 'Student teams pitching ideas and sketching prototypes in the media center',
    fallbackLabel: 'Entrepreneurship',
  },
  'Social & Volunteering': {
    src: '/src/assets/images/event_student_council_1794978939642.jpg',
    alt: 'Students organizing community service projects on campus',
    fallbackLabel: 'Social & Volunteering',
  },
};

export function getClubCoverMedia(
  clubName: string,
  category: ClubCategory,
  dynamicCoverUrl?: string
): ClubMediaAsset {
  if (isSafeMediaUrl(dynamicCoverUrl)) {
    return {
      src: dynamicCoverUrl.trim(),
      alt: `${clubName} cover banner`,
      fallbackLabel: category,
    };
  }
  const fallback = CLUB_CATEGORY_COVER_MEDIA[category];
  return {
    ...fallback,
    alt: `${clubName} · ${fallback.alt}`,
  };
}

export function getClubInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s&·-]+/)
    .filter(Boolean);
  if (words.length === 0) return 'OP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}
