import { useState } from 'react';
import { Archive, Info, Megaphone, Send } from 'lucide-react';
import {
  archiveEventAnnouncement,
  publishEventAnnouncement,
} from '../../services/eventOperationsService';
import type { SchoolEvent } from '../../types/event';
import type { EventAnnouncementRecord } from '../../types/eventOperations';
import { formatEventDateTime } from '../../utils/events';
import {
  EVENT_ANNOUNCEMENT_MESSAGE_MAX,
  EVENT_ANNOUNCEMENT_TITLE_MAX,
  validateEventAnnouncementInput,
} from '../../utils/eventOperations';
import { toUserFriendlyErrorMessage } from '../../utils/errorHandling';

interface EventAnnouncementsManagerProps {
  event: SchoolEvent;
  organizerUid: string;
  announcements: EventAnnouncementRecord[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onShowToast: (type: 'error' | 'success', message: string) => void;
}

export function EventAnnouncementsManager({
  event,
  organizerUid,
  announcements,
  loading,
  onRefresh,
  onShowToast,
}: EventAnnouncementsManagerProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateEventAnnouncementInput({ title, message });
    if (!validation.valid) {
      setFormError(validation.errors.title || validation.errors.message || 'Check announcement fields.');
      return;
    }

    setSubmitting(true);
    try {
      await publishEventAnnouncement({
        eventId: event.id,
        schoolId: event.schoolId,
        organizerUid,
        title,
        message,
      });
      setTitle('');
      setMessage('');
      onShowToast('success', 'Event announcement published.');
      await onRefresh();
    } catch (err) {
      setFormError(toUserFriendlyErrorMessage(err, 'Could not publish announcement.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (item: EventAnnouncementRecord) => {
    setArchivingId(item.id);
    try {
      await archiveEventAnnouncement(event.id, item.id);
      onShowToast('success', 'Announcement archived.');
      await onRefresh();
    } catch (err) {
      onShowToast('error', toUserFriendlyErrorMessage(err, 'Could not archive announcement.'));
    } finally {
      setArchivingId(null);
    }
  };

  const activeItems = announcements.filter((a) => a.status === 'active');
  const archivedItems = announcements.filter((a) => a.status === 'archived');

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#525252]">
        <Info className="h-4 w-4 text-[#E85D04] mt-0.5 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">
          Active announcements appear immediately on the Event Details page, inside students' My Events preparation cards, and in Starter Tier in-app notifications. Automated email or push delivery requires Firebase Blaze Cloud Functions.
        </p>
      </div>

      {/* Compose Announcement Form */}
      <form
        onSubmit={(e) => void handlePublish(e)}
        className="rounded-xl border border-[#E5E7EB] bg-white p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
          <h3 className="font-display text-sm font-bold text-[#171717]">
            Publish Event Announcement
          </h3>
        </div>

        <div>
          <label
            htmlFor={`ann-title-${event.id}`}
            className="block text-xs font-semibold text-[#171717] mb-1"
          >
            Headline
          </label>
          <input
            id={`ann-title-${event.id}`}
            type="text"
            maxLength={EVENT_ANNOUNCEMENT_TITLE_MAX}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Room moved to Auditorium B · Bring laptops"
            className="w-full min-h-[40px] rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor={`ann-msg-${event.id}`}
              className="block text-xs font-semibold text-[#171717]"
            >
              Update Message
            </label>
            <span className="font-mono tabular-nums text-[11px] text-[#737373]">
              {message.trim().length}/{EVENT_ANNOUNCEMENT_MESSAGE_MAX}
            </span>
          </div>
          <textarea
            id={`ann-msg-${event.id}`}
            rows={3}
            maxLength={EVENT_ANNOUNCEMENT_MESSAGE_MAX}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share venue changes, check-in timing, materials to bring, or important reminders..."
            className="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-sm text-[#171717] placeholder:text-[#737373] focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/15"
          />
        </div>

        {formError && (
          <p role="alert" className="text-xs font-medium text-[#DC2626]">
            {formError}
          </p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !title.trim() || !message.trim()}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-50 cursor-pointer transition-colors"
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{submitting ? 'Publishing...' : 'Publish Announcement'}</span>
          </button>
        </div>
      </form>

      {/* Active Announcements List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
            Active Announcements ({activeItems.length})
          </h4>
        </div>

        {loading ? (
          <p className="text-xs text-[#737373]">Loading announcements...</p>
        ) : activeItems.length === 0 ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 text-center text-xs text-[#737373]">
            No active announcements posted for this event yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeItems.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-[#E5E7EB] bg-white p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h5 className="text-sm font-bold text-[#171717]">{item.title}</h5>
                    <span className="font-mono text-[11px] text-[#737373]">
                      {formatEventDateTime(item.createdAt, new Date(), event.timezone)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
                    {item.message}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={archivingId === item.id}
                  onClick={() => void handleArchive(item)}
                  className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-medium text-[#525252] hover:bg-[#F8F9FA] hover:text-[#171717] disabled:opacity-50 shrink-0 cursor-pointer"
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{archivingId === item.id ? 'Archiving...' : 'Archive'}</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Archived Announcements */}
      {archivedItems.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-[#E5E7EB]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#737373]">
            Archived ({archivedItems.length})
          </h4>
          <div className="space-y-2">
            {archivedItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-4 py-3 text-xs text-[#737373]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#525252]">{item.title}</span>
                  <span className="font-mono text-[11px]">
                    {formatEventDateTime(item.createdAt, new Date(), event.timezone)}
                  </span>
                </div>
                <p className="mt-1">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
