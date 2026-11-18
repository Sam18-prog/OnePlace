import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  Info,
  Megaphone,
  Save,
  Smartphone,
  Users,
} from 'lucide-react';
import type { EventCategory } from '../../types/event';
import type { NotificationPreferences, PushPermissionState } from '../../types/notification';
import { InterestSelector } from '../personalization/InterestSelector';

interface NotificationPreferencesViewProps {
  isSignedIn: boolean;
  preferences: NotificationPreferences;
  loading: boolean;
  saving: boolean;
  pushPermission: PushPermissionState;
  pushBusy: boolean;
  pushStatusNote: string | null;
  vapidConfigured: boolean;
  onBack: () => void;
  onSave: (nextPrefs: NotificationPreferences) => Promise<boolean>;
  onEnableAll: () => Promise<void>;
  onDisableAll: () => Promise<void>;
  onEnablePush: () => Promise<void>;
  onDisablePush: () => Promise<void>;
  onSignIn: () => void;
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 first:pt-1 last:pb-1">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-sm font-semibold text-[#171717]">{label}</span>
        <span className="mt-0.5 block text-xs text-[#737373] leading-relaxed">{description}</span>
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
          checked
            ? 'border-[#E85D04] bg-[#E85D04]'
            : 'border-[#D1D5DB] bg-[#E5E7EB]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
            checked ? 'translate-x-5.5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function NotificationPreferencesView({
  isSignedIn,
  preferences,
  loading,
  saving,
  pushPermission,
  pushBusy,
  pushStatusNote,
  vapidConfigured,
  onBack,
  onSave,
  onEnableAll,
  onDisableAll,
  onEnablePush,
  onDisablePush,
  onSignIn,
}: NotificationPreferencesViewProps) {
  const [draft, setDraft] = useState<NotificationPreferences>(preferences);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(preferences);
    setDirty(false);
  }, [preferences]);

  if (!isSignedIn) {
    return (
      <section className="mx-auto max-w-lg py-6">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-xs">
          <h1 className="font-display text-xl font-extrabold text-[#171717]">
            Notification Preferences
          </h1>
          <p className="mt-2 text-sm text-[#737373]">
            Sign in with Google to customize event reminders, club activity alerts, and campus interests.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] cursor-pointer"
          >
            Sign in with Google
          </button>
        </div>
      </section>
    );
  }

  const updateField = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleToggleInterest = (category: EventCategory) => {
    setDraft((prev) => {
      const exists = prev.interestCategories.includes(category);
      const next = exists
        ? prev.interestCategories.filter((c) => c !== category)
        : [...prev.interestCategories, category];
      return { ...prev, interestCategories: next };
    });
    setDirty(true);
  };

  const permissionBadge = !vapidConfigured
    ? { label: 'Not configured', tone: 'bg-[#F3F4F6] text-[#525252] border-[#E5E7EB]' }
    : pushPermission === 'granted' && draft.pushEnabled
      ? { label: 'Enabled on this device', tone: 'bg-[#16A34A]/10 text-[#15803D] border-[#16A34A]/20' }
      : pushPermission === 'denied'
        ? { label: 'Blocked by browser', tone: 'bg-red-50 text-[#DC2626] border-red-200' }
        : pushPermission === 'unsupported'
          ? { label: 'Unsupported browser', tone: 'bg-[#F3F4F6] text-[#525252] border-[#E5E7EB]' }
          : { label: 'Not enabled', tone: 'bg-[#F8F9FA] text-[#525252] border-[#E5E7EB]' };

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E7EB] pb-5">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#737373] hover:text-[#171717] transition-colors cursor-pointer mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Notification Center</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            Notification Preferences
          </h1>
          <p className="mt-1 text-sm text-[#737373]">
            Control which reminders, club updates, and announcements reach your OnePlace inbox.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void onEnableAll()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
          >
            <Bell className="h-3.5 w-3.5 text-[#16A34A]" aria-hidden="true" />
            <span>Enable all</span>
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void onDisableAll()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#737373] hover:text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
          >
            <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Disable all</span>
          </button>
        </div>
      </div>

      {/* 1. Delivery Channels & Optional Browser Push */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#171717]">
            Delivery Channels
          </h2>
        </div>

        <div className="divide-y divide-[#E5E7EB]">
          <ToggleRow
            id="pref-in-app"
            label="In-app Notification Center"
            description="Show reminders, schedule changes, announcements, and club activity inside the OnePlace bell inbox."
            checked={draft.inAppEnabled}
            onChange={(val) => updateField('inAppEnabled', val)}
          />

          <div className="pt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#171717]">
                    Opt-in Browser Push Notifications (FCM)
                  </span>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${permissionBadge.tone}`}
                  >
                    {permissionBadge.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#737373] leading-relaxed">
                  {vapidConfigured
                    ? 'Receive timely 24h & 1h event reminders and urgent cancellations even when OnePlace is closed. Permission is requested only when you click below.'
                    : 'Optional Web Push delivery via Firebase Cloud Messaging. Currently disabled in Starter Tier mode; in-app notifications continue operating normally.'}
                </p>
              </div>

              <div className="shrink-0">
                {!vapidConfigured ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F3F4F6] px-3.5 py-1.5 text-xs font-semibold text-[#737373] cursor-not-allowed"
                  >
                    <BellOff className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Push Not Configured</span>
                  </button>
                ) : pushPermission === 'granted' && draft.pushEnabled ? (
                  <button
                    type="button"
                    disabled={pushBusy}
                    onClick={() => void onDisablePush()}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#171717] hover:bg-[#F8F9FA] disabled:opacity-50 cursor-pointer"
                  >
                    <BellOff className="h-3.5 w-3.5 text-[#737373]" aria-hidden="true" />
                    <span>{pushBusy ? 'Updating...' : 'Disable Push'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={pushBusy || pushPermission === 'unsupported' || pushPermission === 'denied'}
                    onClick={() => void onEnablePush()}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#E85D04] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-50 cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{pushBusy ? 'Requesting...' : 'Enable Browser Push'}</span>
                  </button>
                )}
              </div>
            </div>

            {!vapidConfigured && (
              <div className="flex items-start gap-2 rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] px-3.5 py-2.5 text-xs text-[#525252]">
                <Info className="h-4 w-4 text-[#E85D04] shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Browser push notifications require upgrading the Firebase project to generate a Web Push VAPID key (<code className="font-mono text-[#171717]">VITE_FIREBASE_VAPID_KEY</code>) and deploy background Cloud Functions. Permission requests and FCM token registration are disabled until configured.
                </span>
              </div>
            )}

            {vapidConfigured && pushPermission === 'denied' && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-[#DC2626]">
                <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Browser notification permission is currently blocked for this site. Re-enable notifications in your browser&apos;s site settings to receive push alerts.
                </span>
              </div>
            )}

            {pushStatusNote && (
              <p className="text-xs font-medium text-[#525252] flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#E85D04] shrink-0" aria-hidden="true" />
                <span>{pushStatusNote}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 2. Event Reminders */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#171717]">
            Event Reminders
          </h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          <ToggleRow
            id="pref-rem-24h"
            label="24-hour reminder"
            description="Notify me 24 hours before any published event I have RSVP'd to."
            checked={draft.reminder24h}
            onChange={(val) => updateField('reminder24h', val)}
          />
          <ToggleRow
            id="pref-rem-1h"
            label="1-hour reminder"
            description="Send a final heads-up 1 hour before my RSVP'd event begins."
            checked={draft.reminder1h}
            onChange={(val) => updateField('reminder1h', val)}
          />
        </div>
      </div>

      {/* 3. Followed Clubs */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#171717]">
            Followed Clubs
          </h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          <ToggleRow
            id="pref-club-new"
            label="New events from followed clubs"
            description="Alert me when a club I follow publishes a new campus event."
            checked={draft.clubNewEvents}
            onChange={(val) => updateField('clubNewEvents', val)}
          />
          <ToggleRow
            id="pref-club-updates"
            label="Important updates &amp; cancellations"
            description="Notify me if a followed club or RSVP'd event changes time, room, or is cancelled."
            checked={draft.clubEventUpdates}
            onChange={(val) => updateField('clubEventUpdates', val)}
          />
        </div>
      </div>

      {/* 4. Campus Announcements */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-[#171717]">
            Campus Announcements
          </h2>
        </div>
        <div className="divide-y divide-[#E5E7EB]">
          <ToggleRow
            id="pref-school-ann"
            label="School-wide announcements"
            description="Receive general campus announcements published by school administrators."
            checked={draft.schoolAnnouncements}
            onChange={(val) => updateField('schoolAnnouncements', val)}
          />
          <ToggleRow
            id="pref-important-notices"
            label="Important campus notices"
            description="High-priority school schedule advisories and urgent campus alerts."
            checked={draft.importantNotices}
            onChange={(val) => updateField('importantNotices', val)}
          />
        </div>
      </div>

      {/* 5. Optional Discovery Interests */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 sm:p-6 shadow-xs">
        <InterestSelector
          selectedInterests={draft.interestCategories}
          onToggleInterest={handleToggleInterest}
        />
      </div>

      {/* Save Preferences Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-xs">
        <p className="text-xs text-[#737373]">
          {dirty
            ? 'You have unsaved changes to your notification preferences.'
            : 'All notification preferences are up to date.'}
        </p>
        <button
          type="button"
          disabled={saving || loading}
          onClick={() => void onSave(draft)}
          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#E85D04] px-5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-[#DC2F02] disabled:opacity-60 transition-colors cursor-pointer"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{saving ? 'Saving...' : 'Save preferences'}</span>
        </button>
      </div>
    </section>
  );
}
