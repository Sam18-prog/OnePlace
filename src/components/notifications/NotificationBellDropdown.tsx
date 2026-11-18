import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCheck,
  Megaphone,
  Settings,
  Users,
} from 'lucide-react';
import type { AppNotification, NotificationType } from '../../types/notification';
import {
  formatRelativeNotificationTime,
  formatUnreadBadgeCount,
  NOTIFICATION_TYPE_LABELS,
} from '../../utils/notificationValidation';

interface NotificationBellDropdownProps {
  isSignedIn: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  onSelectNotification: (notification: AppNotification) => void;
  onMarkAllRead: () => void;
  onOpenCenter: () => void;
  onOpenPreferences: () => void;
  onSignIn: () => void;
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'event_reminder':
      return BellRing;
    case 'club_activity':
      return Users;
    case 'announcement':
      return Megaphone;
    case 'event_update':
    case 'rsvp_update':
    default:
      return Calendar;
  }
}

export function NotificationBellDropdown({
  isSignedIn,
  notifications,
  unreadCount,
  onSelectNotification,
  onMarkAllRead,
  onOpenCenter,
  onOpenPreferences,
  onSignIn,
}: NotificationBellDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const badgeText = isSignedIn ? formatUnreadBadgeCount(unreadCount) : '';
  const previewItems = notifications.slice(0, 5);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0 && isSignedIn
            ? `Notifications (${unreadCount} unread)`
            : 'Notifications'
        }
        className="relative inline-flex min-h-[40px] min-w-[40px] md:min-h-[38px] md:min-w-[38px] items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-2 text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04]"
      >
        <Bell className="h-4 w-4 text-[#525252]" aria-hidden="true" />
        {badgeText && (
          <span className="font-mono tabular-nums absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E85D04] px-1 text-[9px] font-bold text-white shadow-xs">
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Recent notifications"
          className="fixed inset-x-4 top-[62px] sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-96 rounded-2xl border border-[#E5E7EB] bg-white shadow-xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold text-[#171717]">
                Notifications
              </span>
              {isSignedIn && unreadCount > 0 && (
                <span className="font-mono tabular-nums rounded-full bg-[#E85D04]/10 px-2 py-0.5 text-[11px] font-semibold text-[#E85D04]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {isSignedIn && unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => onMarkAllRead()}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#525252] hover:bg-[#F8F9FA] hover:text-[#171717] transition-colors cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
                  <span>Mark all</span>
                </button>
              )}
              {isSignedIn && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onOpenPreferences();
                  }}
                  aria-label="Notification preferences"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#737373] hover:bg-[#F8F9FA] hover:text-[#171717] transition-colors cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {!isSignedIn ? (
            <div className="p-5 text-center">
              <p className="text-xs sm:text-sm font-semibold text-[#171717]">
                Stay connected with OnePlace
              </p>
              <p className="mt-1 text-xs text-[#737373]">
                Sign in to receive event reminders, club updates, and campus announcements.
              </p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSignIn();
                }}
                className="mt-3.5 inline-flex min-h-[38px] w-full items-center justify-center rounded-xl bg-[#E85D04] px-4 py-2 text-xs font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
              >
                Sign in with Google
              </button>
            </div>
          ) : previewItems.length === 0 ? (
            <div className="px-4 py-7 text-center">
              <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
                <Check className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-[#171717]">You&apos;re all caught up</p>
              <p className="mt-1 text-[11px] text-[#737373]">
                Event reminders and followed club alerts will appear here.
              </p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
              {previewItems.map((item) => {
                const Icon = getTypeIcon(item.type);
                const isUnread = item.status === 'unread';
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelectNotification(item);
                    }}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F8F9FA] cursor-pointer ${
                      isUnread ? 'bg-[#E85D04]/[0.03]' : 'bg-white'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        isUnread
                          ? 'border-[#E85D04]/25 bg-[#E85D04]/10 text-[#E85D04]'
                          : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                          {NOTIFICATION_TYPE_LABELS[item.type]}
                        </span>
                        <span className="font-mono text-[10px] text-[#737373] shrink-0">
                          {formatRelativeNotificationTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-[#171717] line-clamp-1">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#737373] line-clamp-2">
                        {item.message}
                      </p>
                    </div>
                    {isUnread && (
                      <span
                        className="mt-2 h-2 w-2 rounded-full bg-[#E85D04] shrink-0"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {isSignedIn && (
            <div className="border-t border-[#E5E7EB] bg-[#F8F9FA] px-3 py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenCenter();
                }}
                className="flex-1 rounded-lg py-1.5 text-center text-xs font-semibold text-[#E85D04] hover:text-[#DC2F02] transition-colors cursor-pointer"
              >
                Open Notification Center
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
