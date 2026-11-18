import { motion } from 'motion/react';
import { Check, Plus } from 'lucide-react';
import type { Club } from '../../types/club';

interface FollowClubButtonProps {
  club: Club;
  isFollowing: boolean;
  isSignedIn: boolean;
  onFollowClick: (club: Club) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function FollowClubButton({
  club,
  isFollowing,
  isSignedIn,
  onFollowClick,
  size = 'sm',
  className = '',
}: FollowClubButtonProps) {
  const isSuspended = club.status !== 'active';
  const heightClass = size === 'md' ? 'min-h-[44px] px-5 py-2 text-sm' : 'min-h-[40px] px-3.5 py-1.5 text-xs';

  return (
    <motion.button
      type="button"
      disabled={isSuspended && !isFollowing}
      onClick={(e) => {
        e.stopPropagation();
        onFollowClick(club);
      }}
      aria-pressed={isFollowing}
      aria-label={
        isFollowing
          ? `Unfollow ${club.name}`
          : isSignedIn
            ? `Follow ${club.name}`
            : `Sign in to follow ${club.name}`
      }
      whileTap={isSuspended && !isFollowing ? undefined : { scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E85D04] ${heightClass} ${
        isSuspended && !isFollowing
          ? 'border border-[#E5E7EB] bg-[#F3F4F6] text-[#737373] cursor-not-allowed'
          : isFollowing
            ? 'border border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-red-50 hover:text-[#DC2626] hover:border-red-200'
            : 'bg-[#E85D04] text-white hover:bg-[#DC2F02]'
      } ${className}`}
    >
      {isFollowing ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Following</span>
        </>
      ) : (
        <>
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{isSuspended ? 'Suspended' : 'Follow'}</span>
        </>
      )}
    </motion.button>
  );
}
