import { useState } from 'react';
import {
  BadgeCheck,
  Bell,
  BellOff,
  CalendarDays,
  Edit3,
  Lock,
  School,
  Users,
} from 'lucide-react';
import type { Club } from '../../types/club';
import { getClubCoverMedia, getClubInitials } from '../../utils/clubMedia';
import { FollowClubButton } from './FollowClubButton';

interface ClubProfileHeaderProps {
  club: Club;
  schoolName: string;
  followerCount: number;
  upcomingEventCount: number;
  isFollowing: boolean;
  notificationsEnabled: boolean;
  isSignedIn: boolean;
  canManage: boolean;
  onFollowClick: (club: Club) => void;
  onToggleNotifications: (club: Club, next: boolean) => void;
  onEditClub: () => void;
}

export function ClubProfileHeader({
  club,
  schoolName,
  followerCount,
  upcomingEventCount,
  isFollowing,
  notificationsEnabled,
  isSignedIn,
  canManage,
  onFollowClick,
  onToggleNotifications,
  onEditClub,
}: ClubProfileHeaderProps) {
  const [coverError, setCoverError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const cover = getClubCoverMedia(club.name, club.category, club.coverImageUrl);
  const initials = getClubInitials(club.name);

  return (
    <header className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xs">
      {/* Large Cover Image */}
      <div className="relative h-44 sm:h-56 md:h-64 w-full overflow-hidden bg-[#F3F4F6]">
        {!coverError ? (
          <img
            src={cover.src}
            alt={cover.alt}
            referrerPolicy="no-referrer"
            onError={() => setCoverError(true)}
            className={`h-full w-full object-cover ${club.status === 'suspended' ? 'opacity-65 grayscale-[40%]' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F3F4F6] text-sm font-mono text-[#737373]">
            {club.category}
          </div>
        )}
      </div>

      {/* Club Identity Bar */}
      <div className="relative px-5 pb-6 pt-12 sm:px-7 md:px-8">
        <div className="absolute -top-9 left-5 sm:left-7 md:left-8 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-[#171717] text-white shadow-md">
          {club.logoUrl && !logoError ? (
            <img
              src={club.logoUrl}
              alt={`${club.name} emblem`}
              referrerPolicy="no-referrer"
              onError={() => setLogoError(true)}
              className="h-full w-full object-cover bg-white"
            />
          ) : (
            <span className="font-display text-xl font-extrabold tracking-tight">{initials}</span>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-medium text-[#E85D04]">{club.category}</span>
              <span aria-hidden="true" className="text-[#D1D5DB]">
                ·
              </span>
              <span className="inline-flex items-center gap-1 text-[#737373]">
                <School className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{schoolName}</span>
              </span>
              {club.visibility === 'school' && (
                <>
                  <span aria-hidden="true" className="text-[#D1D5DB]">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-[#737373]">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>School members only</span>
                  </span>
                </>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
                {club.name}
              </h1>
              {club.isOfficial && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#E85D04]/25 bg-[#E85D04]/10 px-2 py-0.5 text-[11px] font-semibold text-[#DC2F02]">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Official Club</span>
                </span>
              )}
              {club.status === 'suspended' && (
                <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
                  Suspended
                </span>
              )}
            </div>

            {club.shortDescription && (
              <p className="mt-2 text-sm sm:text-base text-[#525252] leading-relaxed">
                {club.shortDescription}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#737373]">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#171717] font-semibold">
                <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>
                  {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#171717] font-semibold">
                <CalendarDays className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>
                  {upcomingEventCount} upcoming {upcomingEventCount === 1 ? 'event' : 'events'}
                </span>
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <FollowClubButton
              club={club}
              isFollowing={isFollowing}
              isSignedIn={isSignedIn}
              onFollowClick={onFollowClick}
              size="md"
            />

            {isSignedIn && isFollowing && (
              <button
                type="button"
                onClick={() => onToggleNotifications(club, !notificationsEnabled)}
                aria-pressed={notificationsEnabled}
                title={notificationsEnabled ? 'Mute club event updates' : 'Enable club event updates'}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
              >
                {notificationsEnabled ? (
                  <>
                    <Bell className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                    <span>Updates on</span>
                  </>
                ) : (
                  <>
                    <BellOff className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                    <span>Muted</span>
                  </>
                )}
              </button>
            )}

            {canManage && (
              <button
                type="button"
                onClick={onEditClub}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-xs sm:text-sm font-semibold text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
              >
                <Edit3 className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                <span>Manage Club</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
