import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BadgeCheck, CalendarDays, Lock, Users } from 'lucide-react';
import type { Club } from '../../types/club';
import { getClubCoverMedia, getClubInitials } from '../../utils/clubMedia';
import { FollowClubButton } from './FollowClubButton';

interface ClubCardProps {
  club: Club;
  index?: number;
  followerCount: number;
  upcomingEventCount: number;
  isFollowing: boolean;
  isSignedIn: boolean;
  onFollowClick: (club: Club) => void;
  onSelectClub: (club: Club) => void;
  reasonTag?: string;
}

export function ClubCard({
  club,
  index = 0,
  followerCount,
  upcomingEventCount,
  isFollowing,
  isSignedIn,
  onFollowClick,
  onSelectClub,
  reasonTag,
}: ClubCardProps) {
  const [coverError, setCoverError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const cover = getClubCoverMedia(club.name, club.category, club.coverImageUrl);
  const initials = getClubInitials(club.name);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index * 0.03, 0.18),
        ease: [0.16, 1, 0.3, 1],
      }}
      data-testid={`club-card-${club.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xs hover:shadow-md hover:border-[#D1D5DB] transition-all duration-200"
    >
      {/* Cover Image */}
      <button
        type="button"
        onClick={() => onSelectClub(club)}
        aria-label={`View ${club.name} profile`}
        className="relative block aspect-[16/9] w-full overflow-hidden bg-[#F3F4F6] text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E85D04]"
      >
        {!coverError ? (
          <img
            src={cover.src}
            alt={cover.alt}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setCoverError(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-[#737373]">
            <span className="font-mono text-xs font-medium">{club.category}</span>
          </div>
        )}
      </button>

      {/* Content */}
      <div className="relative flex flex-1 flex-col justify-between p-5 pt-7">
        {/* Overlapping Club Logo / Monogram */}
        <button
          type="button"
          onClick={() => onSelectClub(club)}
          aria-hidden="true"
          tabIndex={-1}
          className="absolute -top-6 left-5 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-2 border-white bg-[#171717] text-white shadow-sm cursor-pointer"
        >
          {club.logoUrl && !logoError ? (
            <img
              src={club.logoUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-full w-full object-cover bg-white"
            />
          ) : (
            <span className="font-display text-sm font-extrabold tracking-tight">{initials}</span>
          )}
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
            <span className="font-mono text-[11px] font-medium text-[#E85D04]">
              {club.category}
            </span>
            {club.visibility === 'school' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#737373]">
                <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>School</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectClub(club)}
            className="flex w-full items-start gap-1.5 text-left cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <h3 className="font-display text-lg font-bold tracking-tight text-[#171717] group-hover:text-[#E85D04] transition-colors leading-snug">
              {club.name}
            </h3>
            {club.isOfficial && (
              <BadgeCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-[#E85D04]"
                aria-label="Official school club"
              />
            )}
          </button>

          <p className="mt-1.5 text-sm text-[#737373] leading-relaxed line-clamp-2">
            {club.shortDescription || club.description}
          </p>

          {reasonTag && (
            <p className="mt-2.5 text-[11px] font-medium text-[#525252]">{reasonTag}</p>
          )}
        </div>

        {/* Metrics + Actions */}
        <div className="mt-5 pt-4 border-t border-[#E5E7EB]/80 space-y-3.5">
          <div className="flex items-center justify-between gap-2 text-xs text-[#737373]">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <Users className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              <span>
                {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
              </span>
            </span>

            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
              <CalendarDays className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              <span>
                {upcomingEventCount} upcoming
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <FollowClubButton
              club={club}
              isFollowing={isFollowing}
              isSignedIn={isSignedIn}
              onFollowClick={onFollowClick}
            />

            <button
              type="button"
              onClick={() => onSelectClub(club)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] hover:border-[#D1D5DB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View Club</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
