import { Star } from './Star';

/**
 * Logotipo PROVISIONAL (29/09/2026): wordmark tipográfico con la estrella.
 * Se sustituirá por la identidad definitiva (docs/DECISIONS.md).
 */
export function Logo({
  variant = 'inline',
  className = '',
}: {
  variant?: 'inline' | 'stacked';
  className?: string;
}) {
  if (variant === 'stacked') {
    return (
      <span
        className={`inline-flex flex-col items-center gap-3 ${className}`}
        aria-label="ADHARA"
        role="img"
      >
        <Star className="text-gold size-4" />
        <span
          aria-hidden
          className="font-display pl-[0.5em] text-[1.75rem] leading-none font-normal tracking-[0.5em]"
        >
          ADHARA
        </span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className}`}
      aria-label="ADHARA"
      role="img"
    >
      <Star className="text-gold size-2.5" />
      <span
        aria-hidden
        className="font-display pl-[0.42em] text-xl leading-none font-normal tracking-[0.42em]"
      >
        ADHARA
      </span>
    </span>
  );
}
