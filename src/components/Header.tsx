import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { motion } from 'motion/react';
import {
  BookmarkCheck,
  ChevronDown,
  Compass,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  Search,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import type { AppView } from '../types/event';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onFocusSearch: () => void;
  user: User | null;
  authLoading: boolean;
  isRefreshing: boolean;
  rsvpTotalCount: number;
  canAccessOrganizer?: boolean;
  onRefresh: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function Header({
  activeView,
  onNavigate,
  onFocusSearch,
  user,
  authLoading,
  isRefreshing,
  rsvpTotalCount,
  canAccessOrganizer = false,
  onRefresh,
  onSignIn,
  onSignOut,
}: HeaderProps) {
  const [avatarError, setAvatarError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const navItems: { id: AppView; label: string; icon: typeof Compass; badge?: number }[] = [
    { id: 'discover', label: 'Discover', icon: Sparkles },
    { id: 'explore', label: 'Explore Events', icon: Compass },
    {
      id: 'my-rsvps',
      label: 'My RSVPs',
      icon: BookmarkCheck,
      badge: user && rsvpTotalCount > 0 ? rsvpTotalCount : undefined,
    },
    ...(canAccessOrganizer
      ? [{ id: 'organizer' as AppView, label: 'Organizer', icon: LayoutDashboard }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[#E5E7EB] bg-white">
      <div className="mx-auto flex h-14 md:h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="inline-flex items-center gap-2.5 rounded-lg text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E85D04] text-white shrink-0"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
            <span className="font-display text-lg font-extrabold tracking-tight text-[#171717] whitespace-nowrap">
              OnePlace
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                    isActive
                      ? 'text-[#171717]'
                      : 'text-[#737373] hover:text-[#171717]'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="desktop-nav-active"
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded-lg bg-[#F3F4F6] -z-10"
                      aria-hidden="true"
                    />
                  )}
                  <span>{item.label}</span>
                  {typeof item.badge === 'number' && (
                    <span className="font-mono tabular-nums inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E85D04]/10 px-1.5 text-[11px] font-semibold text-[#E85D04]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onFocusSearch}
            aria-label="Search events"
            className="hidden lg:inline-flex min-h-[38px] items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-3 py-1.5 text-xs font-medium text-[#737373] hover:border-[#D1D5DB] hover:text-[#171717] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <Search className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
            <span>Search</span>
          </button>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh events"
            title="Refresh events"
            className="inline-flex min-h-[40px] min-w-[40px] md:min-h-[38px] md:min-w-[38px] items-center justify-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 md:px-3 py-1.5 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
          >
            <RefreshCw
              className={`h-4 w-4 text-[#737373] ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {authLoading ? (
            <div
              className="h-9 w-24 animate-pulse rounded-lg bg-[#E5E7EB]/70"
              aria-hidden="true"
            />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="inline-flex min-h-[40px] md:min-h-[38px] items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2 sm:px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
              >
                {user.photoURL && !avatarError ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ? `${user.displayName} avatar` : 'Student avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarError(true)}
                    className="h-6 w-6 rounded-full border border-[#E5E7EB] object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F8F9FA] text-[#737373] border border-[#E5E7EB] shrink-0"
                    aria-hidden="true"
                  >
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                )}
                <span className="hidden sm:inline max-w-[120px] truncate text-xs font-medium text-[#171717]">
                  {user.displayName || user.email || 'Student'}
                </span>
                <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Account options"
                  className="absolute right-0 mt-2 w-60 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-lg z-50"
                >
                  <div className="px-3 py-2 border-b border-[#E5E7EB]">
                    <p className="text-xs font-semibold text-[#171717] truncate">
                      {user.displayName || 'Student Account'}
                    </p>
                    {user.email && (
                      <p className="text-[11px] text-[#737373] truncate">{user.email}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate('my-rsvps');
                    }}
                    className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-2">
                      <BookmarkCheck className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                      My RSVPs
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-[#737373]">
                      {rsvpTotalCount}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate('profile');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    Profile
                  </button>
                  {canAccessOrganizer && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('organizer');
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#E85D04] hover:bg-[#E85D04]/10 transition-colors cursor-pointer"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
                      Organizer Studio
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex min-h-[40px] md:min-h-[38px] items-center justify-center rounded-lg bg-[#E85D04] px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] active:scale-[0.98] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
