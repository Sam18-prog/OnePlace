import { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Check,
  CheckCheck,
  ChevronRight,
  Megaphone,
  Settings,
  Users,
} from 'lucide-react';
import type { AppNotification, NotificationType } from '../../types/notification';
import {
  filterNotifications,
  formatRelativeNotificationTime,
  NOTIFICATION_TYPE_LABELS,
  type NotificationFilterOption,
} from '../../utils/notificationValidation';

interface NotificationCenterViewProps {
  isSignedIn: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectNotification: (notification: AppNotification) => void;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onOpenPreferences: () => void;
  onSignIn: () => void;
}

const FILTER_TABS: { id: NotificationFilterOption; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'event_reminder', label: 'Reminders' },
  { id: 'club_activity', label: 'Club Activity' },
  { id: 'event_update', label: 'Event Updates' },
  { id: 'announcement', label: 'Announcements' },
  { id: 'rsvp_update', label: 'RSVP Updates' },
];

function getCategoryIcon(type: NotificationType) {
  switch (type) {
    case 'event_reminder':
      return BellRing;
    case 'club_activity':
      return Users;
    case 'announcement':
      return Megaphone;
    case 'rsvp_update':
      return Check;
    case 'event_update':
    default:
      return Calendar;
  }
}

export function NotificationCenterView({
  isSignedIn,
  notifications,
  unreadCount,
  loading,
  error,
  hasMore,
  onLoadMore,
  onSelectNotification,
  onMarkAsRead,
  onMarkAllRead,
  onOpenPreferences,
  onSignIn,
}: NotificationCenterViewProps) {
  const [filter, setFilter] = useState<NotificationFilterOption>('all');

  const filtered = useMemo(
    () => filterNotifications(notifications, filter),
    [filter, notifications]
  );

  if (!isSignedIn) {
    return (
      <section className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
            <Bell className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-xl font-extrabold text-[#171717]">
            Notification Center
          </h1>
          <p className="mt-2 text-sm text-[#737373] leading-relaxed">
            Sign in with your Google account to view event reminders, updates from clubs you follow, and campus announcements.
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
    <section className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <p className="font-mono text-xs font-medium text-[#E85D04]">Inbox</p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            Notification Center
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Reminders for upcoming RSVPs, updates from followed clubs, and official school notices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
            >
              <CheckCheck className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
              <span>Mark all read ({unreadCount})</span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenPreferences}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#171717] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Preferences</span>
          </button>
        </div>
      </div>

      {/* Category Filter Strip */}
      <div
        className="flex items-center gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible pb-1"
        role="tablist"
        aria-label="Filter notifications by category"
      >
        {FILTER_TABS.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'border-[#171717] bg-[#171717] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#525252] hover:border-[#D1D5DB] hover:text-[#171717]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === 'unread' && unreadCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] opacity-85">
                  {unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xs">
          <p className="font-display text-base font-bold text-[#171717]">
            Unable to load notifications
          </p>
          <p className="mt-1 text-sm text-[#737373]">{error}</p>
        </div>
      ) : loading ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] shadow-xs">
          {[1, 2, 3].map((row) => (
            <div key={row} className="p-4 sm:p-5 flex items-start gap-4 animate-pulse">
              <div className="h-9 w-9 rounded-xl bg-[#E5E7EB]" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-[#E5E7EB]" />
                <div className="h-4 w-2/3 rounded bg-[#E5E7EB]" />
                <div className="h-3 w-5/6 rounded bg-[#E5E7EB]" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-xs">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-bold text-[#171717]">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h2>
          <p className="mt-1 text-sm text-[#737373] max-w-md mx-auto">
            {filter === 'unread'
              ? 'You have read all recent campus updates and event reminders.'
              : 'When you RSVP to events or follow campus clubs, timely updates and reminders will appear here.'}
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="mt-4 inline-flex min-h-[38px] items-center rounded-xl border border-[#E5E7EB] bg-white px-4 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
            >
              View all notifications
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white divide-y divide-[#E5E7EB] shadow-xs overflow-hidden">
            {filtered.map((item) => {
              const Icon = getCategoryIcon(item.type);
              const isUnread = item.status === 'unread';
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 transition-colors ${
                    isUnread ? 'bg-[#E85D04]/[0.03]' : 'bg-white'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectNotification(item)}
                    className="flex items-start gap-3.5 text-left flex-1 min-w-0 group cursor-pointer"
                  >
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                        isUnread
                          ? 'border-[#E85D04]/25 bg-[#E85D04]/10 text-[#E85D04]'
                          : 'border-[#E5E7EB] bg-[#F8F9FA] text-[#737373]'
                      }`}
                      aria-hidden="true"
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                          {NOTIFICATION_TYPE_LABELS[item.type]}
                        </span>
                        <span className="text-[#D1D5DB]" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono text-[11px] text-[#737373]">
                          {formatRelativeNotificationTime(item.createdAt)}
                        </span>
                        {isUnread && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#E85D04]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#DC2F02]">
                            New
                          </span>
                        )}
                      </div>

                      <p className="mt-1 font-display text-sm sm:text-base font-bold text-[#171717] group-hover:text-[#E85D04] transition-colors">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm text-[#525252] leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(item.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
                      >
                        <Check className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
                        <span>Mark read</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectNotification(item)}
                      aria-label={`Open ${item.title}`}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-[#F8F9FA] px-2.5 py-1 text-xs font-medium text-[#171717] hover:bg-[#E5E7EB]/60 cursor-pointer"
                    >
                      <span>Open</span>
                      <ChevronRight className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={onLoadMore}
                className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-[#E5E7EB] bg-white px-5 py-2 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] cursor-pointer"
              >
                Load more notifications
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
