import { useState } from 'react';
import type { User } from 'firebase/auth';
import { BookmarkCheck, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';

interface ProfileViewProps {
  user: User | null;
  rsvpCount: number;
  onSignIn: () => void;
  onSignOut: () => void;
  onOpenMyEvents: () => void;
}

export function ProfileView({
  user,
  rsvpCount,
  onSignIn,
  onSignOut,
  onOpenMyEvents,
}: ProfileViewProps) {
  const [avatarError, setAvatarError] = useState(false);

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
            <h1 className="font-display text-lg font-extrabold tracking-tight text-[#171717] truncate">
              {user.displayName || 'Student'}
            </h1>
            {user.email && (
              <p className="text-xs sm:text-sm text-[#737373] truncate">{user.email}</p>
            )}
            <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#16A34A]">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verified Google Account
            </p>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[#E5E7EB] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#737373]">Active RSVPs</p>
            <p className="font-mono tabular-nums text-xl font-bold text-[#171717]">
              {rsvpCount}
            </p>
          </div>
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
