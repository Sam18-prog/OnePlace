import type { AppView } from '../types/event';

interface FooterProps {
  onNavigate: (view: AppView) => void;
  onOpenFeedback?: () => void;
  totalEvents: number;
  totalClubs?: number;
  canAccessOrganizer?: boolean;
  schoolName?: string;
  schoolLocation?: string;
}

export function Footer({
  onNavigate,
  onOpenFeedback,
  totalEvents,
  totalClubs,
  canAccessOrganizer = false,
  schoolName,
  schoolLocation,
}: FooterProps) {
  return (
    <footer className="border-t border-[#E5E7EB] bg-white mt-12 pb-20 md:pb-8">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md bg-[#E85D04] text-white shrink-0"
              aria-hidden="true"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" />
                <rect
                  x="13"
                  y="4"
                  width="7"
                  height="7"
                  rx="2"
                  fill="currentColor"
                  fillOpacity="0.65"
                />
                <rect x="4" y="13" width="16" height="7" rx="2" fill="currentColor" />
              </svg>
            </span>
            <span className="font-display text-sm font-extrabold tracking-tight text-[#171717]">
              OnePlace
            </span>
            {schoolName && (
              <span className="text-xs text-[#737373]">
                · {schoolName}
                {schoolLocation ? ` (${schoolLocation})` : ''}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-[#737373]">
            Everything happening. All in OnePlace. ·{' '}
            <span className="font-mono tabular-nums">{totalEvents}</span> campus events
            {typeof totalClubs === 'number' && (
              <>
                {' '}
                · <span className="font-mono tabular-nums">{totalClubs}</span> clubs
              </>
            )}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-[#737373]" aria-label="Footer navigation">
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="hover:text-[#171717] transition-colors cursor-pointer"
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => onNavigate('explore')}
            className="hover:text-[#171717] transition-colors cursor-pointer"
          >
            Explore Events
          </button>
          <button
            type="button"
            onClick={() => onNavigate('clubs')}
            className="hover:text-[#171717] transition-colors cursor-pointer"
          >
            Clubs
          </button>
          <button
            type="button"
            onClick={() => onNavigate('my-rsvps')}
            className="hover:text-[#171717] transition-colors cursor-pointer"
          >
            My Events
          </button>
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="hover:text-[#171717] transition-colors cursor-pointer"
          >
            Notifications
          </button>
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className="hover:text-[#171717] transition-colors cursor-pointer"
          >
            About OnePlace
          </button>
          {onOpenFeedback && (
            <button
              type="button"
              onClick={onOpenFeedback}
              className="hover:text-[#E85D04] transition-colors cursor-pointer"
            >
              Send Feedback
            </button>
          )}
          {canAccessOrganizer && (
            <button
              type="button"
              onClick={() => onNavigate('organizer')}
              className="hover:text-[#171717] transition-colors cursor-pointer"
            >
              Organizer Studio
            </button>
          )}
        </nav>
      </div>
    </footer>
  );
}
