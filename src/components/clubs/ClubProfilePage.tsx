import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Clock,
  Mail,
  MapPin,
  Megaphone,
  School,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { Club } from '../../types/club';
import type { SchoolEvent } from '../../types/event';
import { isPastEvent } from '../../utils/eventValidation';
import { ClubEventSection } from './ClubEventSection';
import { ClubProfileHeader } from './ClubProfileHeader';

interface ClubProfilePageProps {
  club: Club;
  schoolName: string;
  events: SchoolEvent[];
  followerCount: number;
  isFollowing: boolean;
  notificationsEnabled: boolean;
  isSignedIn: boolean;
  canManage: boolean;
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onBack: () => void;
  onFollowClick: (club: Club) => void;
  onToggleNotifications: (club: Club, next: boolean) => void;
  onRsvpClick: (event: SchoolEvent) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onExploreAllClubEvents: (club: Club) => void;
  onManageClub: (club: Club) => void;
}

export function ClubProfilePage({
  club,
  schoolName,
  events,
  followerCount,
  isFollowing,
  notificationsEnabled,
  isSignedIn,
  canManage,
  getEffectiveRsvp,
  onBack,
  onFollowClick,
  onToggleNotifications,
  onRsvpClick,
  onSelectEvent,
  onExploreAllClubEvents,
  onManageClub,
}: ClubProfilePageProps) {
  const now = new Date();
  const clubEvents = events.filter((e) => e.clubId === club.id);
  const upcomingEvents = clubEvents.filter(
    (e) => (e.status === 'published' || e.status === 'cancelled') && !isPastEvent(e, now)
  );
  const pastEvents = clubEvents.filter((e) => isPastEvent(e, now));
  const activeUpcomingCount = upcomingEvents.filter((e) => e.status === 'published').length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 text-[#737373]" aria-hidden="true" />
          <span>Back to Clubs</span>
        </button>

        <button
          type="button"
          onClick={() => onExploreAllClubEvents(club)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-[#E85D04] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
        >
          <span>Explore all club events</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {club.status === 'suspended' && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          <AlertTriangle className="h-5 w-5 text-[#DC2626] mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">This club is currently suspended.</p>
            <p className="mt-0.5 text-xs text-red-700">
              Suspended clubs are hidden from student discovery and cannot publish new events until reactivated by a school administrator.
            </p>
          </div>
        </div>
      )}

      <ClubProfileHeader
        club={club}
        schoolName={schoolName}
        followerCount={followerCount}
        upcomingEventCount={activeUpcomingCount}
        isFollowing={isFollowing}
        notificationsEnabled={notificationsEnabled}
        isSignedIn={isSignedIn}
        canManage={canManage}
        onFollowClick={onFollowClick}
        onToggleNotifications={onToggleNotifications}
        onEditClub={() => onManageClub(club)}
      />

      {club.announcement && (
        <section
          aria-label="Latest club announcement"
          className="rounded-2xl border border-[#E85D04]/25 bg-white p-5 shadow-xs flex items-start gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E85D04]/10 text-[#E85D04]">
            <Megaphone className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#E85D04]">
              Pinned Community Update
            </p>
            <p className="mt-1 text-sm text-[#171717] leading-relaxed">{club.announcement}</p>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.65fr_1fr] gap-7 items-start">
        {/* Main Column: About + Upcoming + Past Events */}
        <div className="space-y-8 min-w-0">
          <section
            aria-labelledby="club-about-heading"
            className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-4"
          >
            <h2
              id="club-about-heading"
              className="font-display text-base font-bold tracking-tight text-[#171717]"
            >
              About {club.name}
            </h2>
            <p className="text-sm sm:text-[15px] text-[#404040] leading-relaxed whitespace-pre-line">
              {club.description}
            </p>

            <div className="pt-4 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5">
                <School className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-[11px] font-medium text-[#737373]">Campus Affiliation</p>
                  <p className="font-semibold text-[#171717]">{schoolName}</p>
                </div>
              </div>

              {club.meetingSchedule && (
                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-medium text-[#737373]">Regular Meetings</p>
                    <p className="font-semibold text-[#171717]">{club.meetingSchedule}</p>
                  </div>
                </div>
              )}

              {club.meetingLocation && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-medium text-[#737373]">Primary Location</p>
                    <p className="font-semibold text-[#171717]">{club.meetingLocation}</p>
                  </div>
                </div>
              )}

              {club.contactEmail && (
                <div className="flex items-start gap-2.5">
                  <Mail className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#737373]">Club Contact</p>
                    <a
                      href={`mailto:${club.contactEmail}`}
                      className="font-semibold text-[#E85D04] hover:underline break-all"
                    >
                      {club.contactEmail}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          <ClubEventSection
            title="Upcoming Events"
            events={upcomingEvents}
            emptyMessage="No upcoming events scheduled right now. Follow this club to stay updated when new events are published."
            isSignedIn={isSignedIn}
            getEffectiveRsvp={getEffectiveRsvp}
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
            onExploreAllClubEvents={() => onExploreAllClubEvents(club)}
          />

          <ClubEventSection
            title="Past Events"
            events={pastEvents}
            emptyMessage="No past events recorded for this club yet."
            isSignedIn={isSignedIn}
            getEffectiveRsvp={getEffectiveRsvp}
            onRsvpClick={onRsvpClick}
            onSelectEvent={onSelectEvent}
          />
        </div>

        {/* Sidebar Column: Organizers & Community */}
        <aside className="space-y-5">
          {/* Organizers Section (Public Approved Display Metadata Only) */}
          <section
            aria-labelledby="club-organizers-heading"
            className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2
                id="club-organizers-heading"
                className="font-display text-sm font-bold text-[#171717] flex items-center gap-2"
              >
                <ShieldCheck className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>Organizers</span>
              </h2>
              <span className="font-mono text-[11px] text-[#737373]">
                {club.publicOrganizers?.length || 0} listed
              </span>
            </div>

            {club.publicOrganizers && club.publicOrganizers.length > 0 ? (
              <div className="divide-y divide-[#E5E7EB]">
                {club.publicOrganizers.map((org) => (
                  <div key={org.uid} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-sm font-semibold text-[#171717]">{org.displayName}</p>
                    <p className="text-xs text-[#737373]">{org.roleTitle}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#737373] leading-relaxed">
                Managed by verified student club leaders and {schoolName} activities advisors.
              </p>
            )}
          </section>

          {/* Community Section */}
          <section
            aria-labelledby="club-community-heading"
            className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-3.5"
          >
            <h2
              id="club-community-heading"
              className="font-display text-sm font-bold text-[#171717] flex items-center gap-2"
            >
              <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
              <span>Community</span>
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                <p className="text-[11px] font-medium text-[#737373]">Followers</p>
                <p className="mt-1 font-mono tabular-nums text-lg font-bold text-[#171717]">
                  {followerCount}
                </p>
              </div>
              <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3">
                <p className="text-[11px] font-medium text-[#737373]">Events Indexed</p>
                <p className="mt-1 font-mono tabular-nums text-lg font-bold text-[#171717]">
                  {clubEvents.length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-3.5 text-xs text-[#525252] space-y-1.5">
              <p className="font-semibold text-[#171717] flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
                <span>Event &amp; Club Updates</span>
              </p>
              <p className="leading-relaxed text-[#737373]">
                {isFollowing
                  ? notificationsEnabled
                    ? 'You are following this club with new event and announcement updates enabled.'
                    : 'You are following this club with updates currently muted.'
                  : 'Follow this club to keep its upcoming events in your My Clubs feed and customize update preferences.'}
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
