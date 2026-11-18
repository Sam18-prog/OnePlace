import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { EventCategory } from '../types/event';
import { getEventMedia } from '../utils/eventMedia';

interface EventImageProps {
  eventId: string;
  title: string;
  category: EventCategory;
  imageUrl?: string;
  priority?: boolean;
  className?: string;
}

export function EventImage({
  eventId,
  title,
  category,
  imageUrl,
  priority = false,
  className = '',
}: EventImageProps) {
  const [hasError, setHasError] = useState(false);
  const media = getEventMedia(eventId, category, imageUrl, title);

  if (hasError) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 bg-[#F3F4F6] text-[#737373] border border-[#E5E7EB] ${className}`}
        role="img"
        aria-label={`${title} — ${media.fallbackLabel}`}
      >
        <CalendarDays className="h-6 w-6 text-[#737373]" aria-hidden="true" />
        <span className="font-mono text-[11px] font-medium">{media.fallbackLabel}</span>
      </div>
    );
  }

  return (
    <img
      src={media.src}
      alt={media.alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setHasError(true)}
      className={`object-cover bg-[#F3F4F6] ${className}`}
    />
  );
}
