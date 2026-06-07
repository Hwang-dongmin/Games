import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useTouchPrimary } from './use-mobile';

/** Matches CSS rotate(13deg) on the vertical split line through card center */
export const SPLIT_MODE_DEG = 13;

export function clipPathsForSplitModeCard(
  width: number,
  height: number,
  splitDeg = SPLIT_MODE_DEG,
) {
  const k = 0.5 * (height / width) * Math.tan((splitDeg * Math.PI) / 180);
  const top = (0.5 + k) * 100;
  const bottom = (0.5 - k) * 100;
  return {
    left: `polygon(0 0, ${top}% 0, ${bottom}% 100%, 0 100%)`,
    right: `polygon(${top}% 0, 100% 0, 100% 100%, ${bottom}% 100%)`,
  };
}

export type SplitModeOption = {
  href: string;
  ariaLabel: string;
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
};

export type SplitModeHoverCardProps = {
  className?: string;
  defaultContent: ReactNode;
  left: SplitModeOption;
  right: SplitModeOption;
  background?: ReactNode;
  overlay?: ReactNode;
  touchRevealLabel?: string;
};

function SplitModeChoicePanel({
  option,
  side,
}: {
  option: SplitModeOption;
  side: 'left' | 'right';
}) {
  return (
    <div
      className={`split-mode-choice split-mode-choice-${side} flex h-full flex-col items-center justify-center gap-2 px-2 py-5 text-center @md:gap-2.5 @md:px-3 @md:py-6 @lg:px-4`}
    >
      <div className="split-mode-choice-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm @md:h-12 @md:w-12 @xl:h-14 @xl:w-14">
        {option.icon}
      </div>
      <div className="split-mode-choice-copy flex min-w-0 flex-col items-center gap-1">
        <span className="text-2xl font-bold leading-tight tracking-tight text-white @md:text-3xl @lg:text-4xl @xl:text-5xl">
          {option.title}
        </span>
        {option.subtitle != null && (
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 @md:text-sm @lg:text-base @xl:text-lg">
            {option.subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export function SplitModeHoverCard({
  className,
  defaultContent,
  left,
  right,
  background,
  overlay,
  touchRevealLabel = '탭하여 모드 선택',
}: SplitModeHoverCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLAnchorElement>(null);
  const rightRef = useRef<HTMLAnchorElement>(null);
  const touchPrimary = useTouchPrimary();
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const leftZone = leftRef.current;
    const rightZone = rightRef.current;
    if (!card || !leftZone || !rightZone) return;

    const apply = () => {
      const { width, height } = card.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const clips = clipPathsForSplitModeCard(width, height);
      leftZone.style.clipPath = clips.left;
      rightZone.style.clipPath = clips.right;
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(card);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!touchPrimary) setRevealed(false);
  }, [touchPrimary]);

  useEffect(() => {
    if (!touchPrimary || !revealed) return;
    const onPointerDown = (e: PointerEvent) => {
      const card = cardRef.current;
      if (card && !card.contains(e.target as Node)) setRevealed(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [touchPrimary, revealed]);

  const showRevealed = touchPrimary && revealed;

  return (
    <div
      ref={cardRef}
      tabIndex={touchPrimary ? undefined : 0}
      aria-expanded={touchPrimary ? revealed : undefined}
      className={[
        'split-mode-hover-card @container group relative min-h-[13.5rem] overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:border-white/40 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-within:border-white/40 focus-within:scale-105 focus-within:shadow-2xl focus-within:shadow-purple-500/50',
        showRevealed
          ? 'split-mode-hover-card--revealed border-white/40 scale-105 shadow-2xl shadow-purple-500/50'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {background != null && (
        <div
          className={[
            'absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30 group-focus-within:opacity-30',
            showRevealed ? 'opacity-30' : '',
          ].join(' ')}
        >
          {background}
        </div>
      )}
      {overlay != null && (
        <div
          className={[
            'absolute inset-0 opacity-60 transition-opacity group-hover:opacity-80 group-focus-within:opacity-80',
            showRevealed ? 'opacity-80' : '',
          ].join(' ')}
        >
          {overlay}
        </div>
      )}

      <div className="split-mode-split-line pointer-events-none absolute z-30" aria-hidden />

      <div className="relative z-10 flex h-full flex-col p-6">
        <div className="split-mode-default flex flex-1 flex-col transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
          {defaultContent}
        </div>

        {touchPrimary && !revealed && (
          <button
            type="button"
            className="absolute inset-0 z-[15] cursor-pointer rounded-[inherit]"
            aria-label={touchRevealLabel}
            onClick={() => setRevealed(true)}
          />
        )}

        <div className="split-mode-choices absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <Link
            ref={leftRef}
            to={left.href}
            aria-label={left.ariaLabel}
            className="split-mode-zone split-mode-zone-left absolute inset-0"
          />
          <Link
            ref={rightRef}
            to={right.href}
            aria-label={right.ariaLabel}
            className="split-mode-zone split-mode-zone-right absolute inset-0"
          />

          <div className="pointer-events-none relative z-[1] grid h-full grid-cols-2">
            <SplitModeChoicePanel option={left} side="left" />
            <SplitModeChoicePanel option={right} side="right" />
          </div>
        </div>
      </div>
    </div>
  );
}
