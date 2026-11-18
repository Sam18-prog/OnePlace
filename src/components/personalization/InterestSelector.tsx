import { Check, Sparkles } from 'lucide-react';
import type { EventCategory } from '../../types/event';
import { EVENT_CATEGORIES } from '../../utils/events';

interface InterestSelectorProps {
  selectedInterests: EventCategory[];
  onToggleInterest: (category: EventCategory) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export function InterestSelector({
  selectedInterests,
  onToggleInterest,
  title = 'Campus Interests (Optional)',
  subtitle = 'Select topics you care about to highlight matching campus events in your Discover feed.',
  compact = false,
}: InterestSelectorProps) {
  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      <div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#E85D04]" aria-hidden="true" />
          <h3 className="font-display text-sm font-bold text-[#171717]">{title}</h3>
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[#737373] leading-relaxed">{subtitle}</p>
        )}
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Campus interest categories"
      >
        {EVENT_CATEGORIES.map((category) => {
          const selected = selectedInterests.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => onToggleInterest(category)}
              aria-pressed={selected}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${
                selected
                  ? 'border-[#E85D04] bg-[#E85D04]/10 text-[#DC2F02]'
                  : 'border-[#E5E7EB] bg-white text-[#525252] hover:border-[#D1D5DB] hover:text-[#171717]'
              }`}
            >
              {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span>{category}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
