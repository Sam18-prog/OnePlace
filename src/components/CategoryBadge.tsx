import type { EventCategory } from '../types/event';

interface CategoryBadgeProps {
  category: EventCategory;
  size?: 'sm' | 'md';
}

const CATEGORY_STYLES: Record<EventCategory, string> = {
  'STEM & Makers': 'bg-[#2563EB]/[0.07] text-[#1D4ED8] border-[#2563EB]/15',
  Leadership: 'bg-[#E85D04]/[0.08] text-[#C2410C] border-[#E85D04]/15',
  Athletics: 'bg-[#16A34A]/[0.08] text-[#15803D] border-[#16A34A]/15',
  Academic: 'bg-[#171717]/[0.05] text-[#404040] border-[#E5E7EB]',
  'Arts & Music': 'bg-[#D97706]/[0.08] text-[#B45309] border-[#D97706]/20',
  'Social & Community': 'bg-[#E85D04]/[0.06] text-[#9A3412] border-[#E85D04]/15',
};

export function CategoryBadge({ category, size = 'sm' }: CategoryBadgeProps) {
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium whitespace-nowrap shrink-0 ${padding} ${CATEGORY_STYLES[category]}`}
    >
      {category}
    </span>
  );
}
