import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Compass,
  Lock,
  MessageSquarePlus,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { SchoolConfig } from '../../config/school';
import type { Club } from '../../types/club';
import type { AppView, SchoolEvent } from '../../types/event';
import { formatEventDateTime } from '../../utils/events';
import { PILOT_STAGES } from '../../utils/onboarding';

interface ProductLandingPageProps {
  schoolConfig: SchoolConfig;
  events: SchoolEvent[];
  clubs: Club[];
  onNavigate: (view: AppView) => void;
  onSelectEvent: (event: SchoolEvent) => void;
  onSelectClub: (club: Club) => void;
  onOpenFeedback: () => void;
}

export function ProductLandingPage({
  schoolConfig,
  events,
  clubs,
  onNavigate,
  onSelectEvent,
  onSelectClub,
  onOpenFeedback,
}: ProductLandingPageProps) {
  const previewEvents = events.filter((e) => e.status === 'published').slice(0, 2);
  const previewClubs = clubs.filter((c) => c.status === 'active').slice(0, 2);

  return (
    <div className="space-y-12 pb-6">
      {/* 1. Editorial Hero + Live Product Preview */}
      <section className="rounded-3xl border border-[#E5E7EB] bg-white p-6 sm:p-10 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-5">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#E85D04]">
              OnePlace · Campus Discovery &amp; Community Platform
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[46px] font-extrabold tracking-tight text-[#171717] leading-[1.08] [text-wrap:balance]">
              Your campus. Your community. Your next experience.
            </h1>
            <p className="text-sm sm:text-base text-[#525252] leading-relaxed max-w-xl">
              OnePlace gives schools a single, mobile-first hub where students discover club meetings and campus events, organizers manage schedules and measure turnout, and administrators maintain privacy-first oversight.
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('discover')}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
                >
                  <span>Open Live Campus Feed</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('clubs')}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#171717] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                >
                  <Users className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                  <span>Explore Clubs</span>
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenFeedback}
                className="inline-flex min-h-[36px] items-center gap-1.5 text-xs sm:text-sm font-medium text-[#525252] hover:text-[#E85D04] transition-colors cursor-pointer"
              >
                <MessageSquarePlus className="h-4 w-4 text-[#737373]" aria-hidden="true" />
                <span>Share Pilot Feedback</span>
              </button>
            </div>
          </div>

          {/* Genuine Live Preview Window (uses real active school data, never fabricated stats) */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#E85D04]">
                    Live Campus Preview
                  </p>
                  <p className="font-display text-sm font-bold text-[#171717] truncate">
                    {schoolConfig.name}
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#737373] shrink-0">
                  {schoolConfig.timezone}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  Published Schedule
                </p>
                {previewEvents.length === 0 ? (
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-xs text-[#737373]">
                    No events are published on this campus feed yet.
                  </div>
                ) : (
                  previewEvents.map((evt) => (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={() => onSelectEvent(evt)}
                      className="block w-full rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-left hover:border-[#D1D5DB] transition-colors cursor-pointer"
                    >
                      <p className="text-xs font-bold text-[#171717] truncate">{evt.title}</p>
                      <p className="mt-0.5 text-[11px] text-[#737373] truncate">
                        {evt.hostClub} · {formatEventDateTime(evt.startAt, new Date(), evt.timezone)}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#737373]">
                  Active Clubs
                </p>
                {previewClubs.length === 0 ? (
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-xs text-[#737373]">
                    Clubs appear here once registered by a school administrator.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {previewClubs.map((club) => (
                      <button
                        key={club.id}
                        type="button"
                        onClick={() => onSelectClub(club)}
                        className="rounded-xl border border-[#E5E7EB] bg-white p-3 text-left hover:border-[#D1D5DB] transition-colors cursor-pointer"
                      >
                        <p className="text-xs font-bold text-[#171717] truncate">{club.name}</p>
                        <p className="mt-0.5 text-[11px] text-[#737373] truncate">
                          {club.category}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How OnePlace Works — 3 Audiences */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#E85D04]">
            How It Works
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            Built around real campus workflows.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-3">
            <Compass className="h-5 w-5 text-[#E85D04]" aria-hidden="true" />
            <h3 className="font-display text-lg font-bold text-[#171717]">For Students</h3>
            <p className="text-sm text-[#525252] leading-relaxed">
              Browse events grouped by Today, This Week, and Later, follow student organizations, save RSVPs in one tap, and get personalized suggestions without creating noisy group chats.
            </p>
          </article>

          <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-3">
            <CalendarDays className="h-5 w-5 text-[#E85D04]" aria-hidden="true" />
            <h3 className="font-display text-lg font-bold text-[#171717]">For Club Organizers</h3>
            <p className="text-sm text-[#525252] leading-relaxed">
              Draft and publish meetings strictly for assigned clubs, maintain club profiles and meeting rooms, post clear cancellation reasons, and track aggregate RSVP performance.
            </p>
          </article>

          <article className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs space-y-3">
            <Building2 className="h-5 w-5 text-[#E85D04]" aria-hidden="true" />
            <h3 className="font-display text-lg font-bold text-[#171717]">For Schools</h3>
            <p className="text-sm text-[#525252] leading-relaxed">
              Configure official branding and canonical timezone, import verified clubs and schedules via validated CSV, manage organizer roles securely, and roll out in controlled pilot stages.
            </p>
          </article>
        </div>
      </section>

      {/* 3. Implemented Capabilities */}
      <section className="space-y-5">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#E85D04]">
            Platform Capabilities
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
            What is live in OnePlace today.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Compass,
              title: 'Mobile-First Event Discovery',
              body: 'Instant search, timeframe filters, category shortcuts, and clean chronological feeds engineered for phones and desktops.',
            },
            {
              icon: Users,
              title: 'Club Directory & Profiles',
              body: 'Dedicated club pages with meeting schedules, locations, official badges, announcements, and one-tap following.',
            },
            {
              icon: CheckCircle2,
              title: 'Atomic, Privacy-First RSVPs',
              body: 'Transaction-backed RSVP counts stay accurate under concurrent signups while keeping individual student attendance private.',
            },
            {
              icon: Bell,
              title: 'In-App Notification Center',
              body: 'Real-time in-app alerts and granular student preferences. Optional browser push activates when VAPID and Cloud Functions are configured.',
            },
            {
              icon: BarChart3,
              title: 'Organizer & Campus Analytics',
              body: 'Role-scoped KPIs, category engagement charts, top-event leaderboards, and PII-free CSV exports derived strictly from real Firestore records.',
            },
            {
              icon: ShieldCheck,
              title: 'School Onboarding & CSV Import',
              body: 'Guided 10-step school setup, row-validated club and event CSV imports, and private pilot feedback review inside Admin Studio.',
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-5 space-y-2"
              >
                <Icon className="h-4 w-4 text-[#E85D04]" aria-hidden="true" />
                <h3 className="font-display text-sm font-bold text-[#171717]">{feat.title}</h3>
                <p className="text-xs text-[#525252] leading-relaxed">{feat.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Privacy & Security Commitments */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#E85D04] flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Privacy &amp; Trust</span>
            </p>
            <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#171717]">
              Designed for student safety from the database rules up.
            </h2>
            <p className="text-sm text-[#525252] leading-relaxed">
              Every permission boundary is enforced in Cloud Firestore security rules, not just hidden in the user interface.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#525252]">
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 space-y-1">
              <p className="font-semibold text-[#171717]">No Student Roster Enumeration</p>
              <p className="leading-relaxed">
                Attendee and club follower subcollections block list queries. Only aggregate counts are visible to organizers and peers.
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 space-y-1">
              <p className="font-semibold text-[#171717]">Zero Self-Service Admin Access</p>
              <p className="leading-relaxed">
                Students cannot elevate their own role. Organizer and administrator permissions are strictly school-scoped and admin-assigned.
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 space-y-1">
              <p className="font-semibold text-[#171717]">Multi-School Data Isolation</p>
              <p className="leading-relaxed">
                Clubs, events, memberships, feedback, and analytics partition strictly by school identifier so campuses remain isolated.
              </p>
            </div>
            <div className="rounded-xl border border-[#E5E7EB] bg-[#F8F9FA] p-4 space-y-1">
              <p className="font-semibold text-[#171717]">PII-Free Exports &amp; Backups</p>
              <p className="leading-relaxed">
                Analytics CSVs and Starter Tier operational JSON backups exclude student emails, attendee lists, and raw user IDs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Controlled Pilot Rollout & School Onboarding CTA */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-[#171717] p-6 sm:p-8 text-white space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F97316]">
              Multi-School Pilot Program
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              Roll out OnePlace to your school in four controlled stages.
            </h2>
            <p className="text-sm text-[#D4D4D4] leading-relaxed">
              Start with a small team of administrators and club leads before opening school-wide student access. Each school receives its own isolated workspace, timezone, and branding.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('discover')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E85D04] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#DC2F02] transition-colors cursor-pointer"
            >
              <span>Explore Live Campus</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onOpenFeedback}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition-colors cursor-pointer"
            >
              <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
              <span>Submit School Inquiry / Feedback</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-white/15">
          {PILOT_STAGES.map((stage) => (
            <div
              key={stage.id}
              className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1.5"
            >
              <p className="font-mono text-[11px] font-semibold text-[#F97316]">
                Stage {stage.stepNumber}
              </p>
              <p className="font-display text-sm font-bold text-white">
                {stage.title.replace(/^Stage \d+ — /, '')}
              </p>
              <p className="text-xs text-[#D4D4D4] leading-relaxed">{stage.audience}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
