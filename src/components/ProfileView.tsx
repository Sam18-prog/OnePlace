import { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  Bell,
  BookmarkCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  Copy,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  MessageSquarePlus,
  Settings,
  ShieldCheck,
  User as UserIcon,
  Users,
} from 'lucide-react';
import type { EventCategory, SchoolEvent } from '../types/event';
import type { MembershipCapabilities, SchoolMembership } from '../types/membership';
import { formatEventTimeOnly, getDateTileParts } from '../utils/events';
import { InterestSelector } from './personalization/InterestSelector';

interface ProfileViewProps {
  user: User | null;
  events: SchoolEvent[];
  rsvpCount: number;
  followedClubsCount?: number;
  unreadNotificationCount?: number;
  selectedInterests?: EventCategory[];
  onToggleInterest?: (category: EventCategory) => void;
  membership: SchoolMembership | null;
  capabilities: MembershipCapabilities;
  getEffectiveRsvp: (event: SchoolEvent) => { rsvpCount: number; isGoing: boolean };
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenMyEvents: () => void;
  onOpenClubs?: () => void;
  onOpenNotifications?: () => void;
  onOpenNotificationPreferences?: () => void;
  onOpenOrganizer: () => void;
  onOpenFeedback?: () => void;
  onOpenStudentTour?: () => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onExplore: () => void;
}

export function ProfileView({
  user,
  events,
  rsvpCount,
  followedClubsCount = 0,
  unreadNotificationCount = 0,
  selectedInterests = [],
  onToggleInterest,
  membership,
  capabilities,
  getEffectiveRsvp,
  onSignIn,
  onSignOut,
  onOpenMyEvents,
  onOpenClubs,
  onOpenNotifications,
  onOpenNotificationPreferences,
  onOpenOrganizer,
  onOpenFeedback,
  onOpenStudentTour,
  onSelectEvent,
  onExplore,
}: ProfileViewProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [showSupportId, setShowSupportId] = useState(false);

  if (!user) {
    return (
      <section className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-7 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
            <UserIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-[#171717]">
            Student Profile
          </h1>
          <p className="mt-2 text-sm text-[#737373] leading-relaxed">
            Sign in with your Google account to save RSVPs, view your event schedule, and sync with your campus community.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </section>
    );
  }

  const attendingEvents = events.filter((event) => getEffectiveRsvp(event).isGoing).slice(0, 3);
  const roleLabel =
    membership?.status === 'suspended'
      ? 'Suspended Account'
      : membership?.role === 'admin'
        ? 'School Administrator'
        : membership?.role === 'organizer'
          ? 'Club Organizer'
          : 'Student';

  const handleCopyUid = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      window.setTimeout(() => setCopiedUid(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <section className="mx-auto max-w-lg py-4 space-y-4">
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs">
        <div className="flex items-center gap-4">
          {user.photoURL && !avatarError ? (
            <img
              src={user.photoURL}
              alt={user.displayName ? `${user.displayName} avatar` : 'Student avatar'}
              referrerPolicy="no-referrer"
              onError={() => setAvatarError(true)}
              className="h-14 w-14 rounded-full border border-[#E5E7EB] object-cover shrink-0"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373] shrink-0">
              <UserIcon className="h-6 w-6" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-extrabold tracking-tight text-[#171717] truncate">
                {user.displayName || 'Student'}
              </h1>
              <span
                className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                  membership?.status === 'suspended'
                    ? 'border-red-200 bg-red-50 text-[#DC2626]'
                    : capabilities.canAccessOrganizer
                      ? 'border-[#E85D04]/25 bg-[#E85D04]/10 text-[#DC2F02]'
                      : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#525252]'
                }`}
              >
                {roleLabel}
              </span>
            </div>
            {user.email && (
              <p className="text-xs sm:text-sm text-[#737373] truncate">{user.email}</p>
            )}
            {user.emailVerified ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Verified Google Account
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#D97706]">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Email verification required for RSVPs and writes
              </p>
            )}
          </div>
        </div>

        {/* Collapsible Support / Role Assignment ID (minimizes passive UID exposure) */}
        <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2">
          <button
            type="button"
            onClick={() => setShowSupportId((prev) => !prev)}
            aria-expanded={showSupportId}
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-medium text-[#525252] hover:text-[#171717] cursor-pointer"
          >
            <span>Need organizer access? Show account support ID</span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-[#737373] transition-transform ${showSupportId ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>

          {showSupportId && (
            <div className="mt-2 pt-2 border-t border-[#E5E7EB] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#737373]">
                  Support &amp; Role Assignment ID
                </p>
                <p className="font-mono text-[11px] text-[#171717] truncate">{user.uid}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyUid()}
                className="inline-flex min-h-[30px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#171717] hover:bg-[#F3F4F6] shrink-0 cursor-pointer"
              >
                {copiedUid ? (
                  <>
                    <Check className="h-3 w-3 text-[#16A34A]" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-[#737373]" aria-hidden="true" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 pt-5 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-[#737373]">Active RSVPs</p>
              <p className="font-mono tabular-nums text-xl font-bold text-[#171717]">
                {rsvpCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#737373]">Followed Clubs</p>
              <p className="font-mono tabular-nums text-xl font-bold text-[#171717]">
                {followedClubsCount}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {capabilities.canAccessOrganizer && (
              <button
                type="button"
                onClick={onOpenOrganizer}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
              >
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                <span>Organizer Studio</span>
              </button>
            )}
            {onOpenClubs && (
              <button
                type="button"
                onClick={onOpenClubs}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer"
              >
                <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <span>My Clubs</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenMyEvents}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-2 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/50 transition-colors cursor-pointer"
            >
              <BookmarkCheck className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
              <span>View My Events</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real RSVP Preview */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-bold text-[#171717]">
            Your Upcoming RSVPs
          </h2>
          {attendingEvents.length > 0 && (
            <button
              type="button"
              onClick={onOpenMyEvents}
              className="text-xs font-medium text-[#E85D04] hover:text-[#DC2F02] cursor-pointer"
            >
              See all
            </button>
          )}
        </div>

        {attendingEvents.length === 0 ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 text-center">
            <p className="text-xs text-[#737373]">
              You haven't RSVP'd to any upcoming events yet.
            </p>
            <button
              type="button"
              onClick={onExplore}
              className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
            >
              <Compass className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
              <span>Explore Events</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB]">
            {attendingEvents.map((evt) => {
              const tile = getDateTileParts(evt.startAt, evt.timezone);
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => onSelectEvent(evt)}
                  className="flex w-full items-center gap-3 py-3 first:pt-1 last:pb-1 text-left group cursor-pointer"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F8F9FA]"
                    aria-hidden="true"
                  >
                    <span className="font-mono text-[9px] font-bold text-[#E85D04] leading-none">
                      {tile.month}
                    </span>
                    <span className="mt-0.5 font-display text-sm font-extrabold text-[#171717] leading-none">
                      {tile.day}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#171717] group-hover:text-[#E85D04] transition-colors truncate">
                      {evt.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-[#737373] truncate">
                      <span className="font-mono">{formatEventTimeOnly(evt.startAt, evt.timezone)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 truncate">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{evt.location}</span>
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#737373] shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Notifications & Personalization Quick Controls */}
      {(onOpenNotifications || onOpenNotificationPreferences || onToggleInterest) && (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-[#171717]">
                Notifications &amp; Discovery
              </h2>
              <p className="mt-0.5 text-xs text-[#737373]">
                Manage event reminders, opt-in browser push alerts, and campus interests.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/60 cursor-pointer"
                >
                  <Bell className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
                  <span>Inbox</span>
                  {unreadNotificationCount > 0 && (
                    <span className="font-mono tabular-nums rounded-full bg-[#E85D04] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              )}
              {onOpenNotificationPreferences && (
                <button
                  type="button"
                  onClick={onOpenNotificationPreferences}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                  <span>Preferences</span>
                </button>
              )}
            </div>
          </div>

          {onToggleInterest && (
            <div className="pt-3 border-t border-[#E5E7EB]">
              <InterestSelector
                selectedInterests={selectedInterests}
                onToggleInterest={onToggleInterest}
                compact
              />
            </div>
          )}
        </div>
      )}

      {/* Privacy, Campus Tour & Pilot Feedback */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-2.5">
          <Lock className="h-4 w-4 text-[#737373] mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="font-display text-sm font-bold text-[#171717]">
              Student Privacy &amp; Data Control
            </h2>
            <p className="text-xs text-[#737373] leading-relaxed">
              Your RSVPs, followed clubs, and notification preferences are private to your account—other students and organizers only see aggregate attendance counts. You can cancel any RSVP, unfollow clubs, or turn off notifications at any time. To request full account record removal, contact your school administrator.
            </p>
          </div>
        </div>

        {(onOpenFeedback || onOpenStudentTour) && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#E5E7EB]">
            {onOpenFeedback && (
              <button
                type="button"
                onClick={onOpenFeedback}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#E5E7EB]/60 cursor-pointer"
              >
                <MessageSquarePlus className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
                <span>Send Feedback</span>
              </button>
            )}
            {onOpenStudentTour && (
              <button
                type="button"
                onClick={onOpenStudentTour}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <Compass className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                <span>Open Campus Tour</span>
              </button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>Sign out</span>
      </button>
    </section>
  );
}
