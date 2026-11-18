import { BookmarkCheck, Compass, Home, User } from 'lucide-react';
import type { AppView } from '../types/event';

interface MobileBottomNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  rsvpCount: number;
  isSignedIn: boolean;
}

export function MobileBottomNav({
  activeView,
  onNavigate,
  rsvpCount,
  isSignedIn,
}: MobileBottomNavProps) {
  const items: { id: AppView; label: string; icon: typeof Home; badge?: number }[] = [
    { id: 'discover', label: 'Home', icon: Home },
    { id: 'explore', label: 'Explore', icon: Compass },
    {
      id: 'my-rsvps',
      label: 'My Events',
      icon: BookmarkCheck,
      badge: isSignedIn && rsvpCount > 0 ? rsvpCount : undefined,
    },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#E5E7EB] bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#E85D04] ${
                isActive ? 'text-[#E85D04]' : 'text-[#737373] hover:text-[#171717]'
              }`}
            >
              <span className="relative inline-flex items-center justify-center">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                {typeof item.badge === 'number' && (
                  <span className="font-mono tabular-nums absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E85D04] px-1 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </span>
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
