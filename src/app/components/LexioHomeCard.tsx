import { useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Layers, Users } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

const LEXIO_IMAGE =
  'https://images.unsplash.com/photo-1606503153255-59d8b8b82176?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';

/** Matches CSS rotate(13deg) on the vertical split line through card center */
const LEXIO_SPLIT_DEG = 13;

function clipPathsForCard(width: number, height: number) {
  const k = 0.5 * (height / width) * Math.tan((LEXIO_SPLIT_DEG * Math.PI) / 180);
  const top = (0.5 + k) * 100;
  const bottom = (0.5 - k) * 100;
  return {
    offline: `polygon(0 0, ${top}% 0, ${bottom}% 100%, 0 100%)`,
    online: `polygon(${top}% 0, 100% 0, 100% 100%, ${bottom}% 100%)`,
  };
}

export default function LexioHomeCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const offlineRef = useRef<HTMLAnchorElement>(null);
  const onlineRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const offline = offlineRef.current;
    const online = onlineRef.current;
    if (!card || !offline || !online) return;

    const apply = () => {
      const { width, height } = card.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      const { offline: offlineClip, online: onlineClip } = clipPathsForCard(
        width,
        height,
      );
      offline.style.clipPath = offlineClip;
      online.style.clipPath = onlineClip;
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(card);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      className="lexio-mode-card @container group relative min-h-[13.5rem] overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 transition-all duration-300 hover:border-white/40 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-within:border-white/40 focus-within:scale-105 focus-within:shadow-2xl focus-within:shadow-purple-500/50"
    >
      <div className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30 group-focus-within:opacity-30">
        <ImageWithFallback
          src={LEXIO_IMAGE}
          alt="렉시오"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-indigo-700 opacity-60 transition-opacity group-hover:opacity-80 group-focus-within:opacity-80" />

      <div className="lexio-mode-split-line pointer-events-none absolute z-30" aria-hidden />

      <div className="relative z-10 flex h-full flex-col p-6">
        <div className="lexio-mode-default flex flex-1 flex-col transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <h3 className="mb-2 text-2xl font-bold text-white">렉시오</h3>
          <p className="flex-grow text-sm text-gray-200">
            AI와 오프라인 플레이, 또는 친구와 온라인 멀티플레이
          </p>
          <div className="mt-4 flex items-center font-medium text-white">
            <span>플레이하기</span>
            <svg
              className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>

        <div className="lexio-mode-choices absolute inset-0 z-20 opacity-0 transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
          <Link
            ref={offlineRef}
            to="/lexio"
            aria-label="렉시오 오프라인 — AI와 플레이"
            className="lexio-mode-zone lexio-mode-zone-offline absolute inset-0"
          />
          <Link
            ref={onlineRef}
            to="/lexio/online"
            aria-label="렉시오 온라인 — 친구와 멀티플레이"
            className="lexio-mode-zone lexio-mode-zone-online absolute inset-0"
          />

          <div className="pointer-events-none relative z-[1] grid h-full grid-cols-2">
            <div className="lexio-mode-choice lexio-mode-choice-offline flex h-full flex-col items-center justify-center gap-2 px-2 py-5 text-center @md:gap-2.5 @md:px-3 @md:py-6 @lg:px-4">
              <div className="lexio-mode-choice-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm @md:h-12 @md:w-12 @xl:h-14 @xl:w-14">
                <Layers className="h-6 w-6 text-white @md:h-7 @md:w-7 @xl:h-8 @xl:w-8" />
              </div>
              <div className="lexio-mode-choice-copy flex min-w-0 flex-col items-center gap-1">
                <span className="text-2xl font-bold leading-tight tracking-tight text-white @md:text-3xl @lg:text-4xl @xl:text-5xl">
                  오프라인
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 @md:text-sm @lg:text-base @xl:text-lg">
                  AI
                </span>
              </div>
            </div>
            <div className="lexio-mode-choice lexio-mode-choice-online flex h-full flex-col items-center justify-center gap-2 px-2 py-5 text-center @md:gap-2.5 @md:px-3 @md:py-6 @lg:px-4">
              <div className="lexio-mode-choice-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm @md:h-12 @md:w-12 @xl:h-14 @xl:w-14">
                <Users className="h-6 w-6 text-white @md:h-7 @md:w-7 @xl:h-8 @xl:w-8" />
              </div>
              <div className="lexio-mode-choice-copy flex min-w-0 flex-col items-center gap-1">
                <span className="text-2xl font-bold leading-tight tracking-tight text-white @md:text-3xl @lg:text-4xl @xl:text-5xl">
                  온라인
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 @md:text-sm @lg:text-base @xl:text-lg">
                  친구와
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
