'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Lumio mascot component (master prompt 6.3).
 * Uses ONLY the supplied brand art (assets/original extracted WebP).
 * The owl is never redrawn. Missing poses/expressions fall back to the
 * nearest supplied art and are logged in docs/ASSET_REQUESTS.md.
 *
 * Mapping (6.3): correct answer -> excited; wrong answer -> thinking (never sad);
 * lost streak -> gentle sad (not supplied -> thinking fallback, see ASSET_REQUESTS);
 * focus -> reading (not supplied -> standing); strict mode -> cool (not supplied ->
 * icon art fallback); empty states -> curious; onboarding -> standing.
 */
export type MascotPose =
  | 'standing'
  | 'happy'
  | 'excited'
  | 'curious'
  | 'thinking'
  | 'cheering'
  | 'icon';

const ART: Record<MascotPose, { src: string; alt: string }> = {
  standing: { src: '/mascot/owl-standing.webp', alt: 'Lumio the owl standing' },
  happy: { src: '/mascot/owl-happy.webp', alt: 'Lumio the owl looking happy' },
  excited: { src: '/mascot/owl-excited.webp', alt: 'Lumio the owl excited, eyes closed' },
  curious: { src: '/mascot/owl-curious.webp', alt: 'Lumio the owl looking curious' },
  thinking: { src: '/mascot/owl-thinking.webp', alt: 'Lumio the owl thinking' },
  cheering: { src: '/mascot/owl-cheering.webp', alt: 'Lumio the owl cheering' },
  icon: { src: '/mascot/owl-icon.webp', alt: 'Lumio owl app icon' },
};

const SIZES = {
  sm: 36,
  md: 64,
  lg: 104,
  xl: 160,
} as const;

export function Mascot({
  pose = 'standing',
  size = 'md',
  className,
  bob = false,
}: {
  pose?: MascotPose;
  size?: keyof typeof SIZES;
  className?: string;
  bob?: boolean;
}) {
  const art = ART[pose];
  return (
    <span
      className={cn('relative inline-block select-none', bob && 'mascot-bob', className)}
      style={{ width: SIZES[size], height: SIZES[size] }}
      aria-hidden={false}
    >
      <Image
        src={art.src}
        alt={art.alt}
        width={SIZES[size] * 2}
        height={SIZES[size] * 2}
        className="object-contain"
        style={{ width: '100%', height: '100%' }}
        priority={size === 'lg' || size === 'xl'}
        draggable={false}
      />
    </span>
  );
}

/** Wordmark: "Lumio" with a sparkle, per the brand sheet (never redrawn as an image — typeset). */
export function LumioWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 font-heading font-bold', className)}>
      Lumio
      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="text-accent">
        <path
          d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z"
          fill="currentColor"
        />
      </svg>
      <span className="sr-only">Learn, Practice, Grow</span>
    </span>
  );
}
