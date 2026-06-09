import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LexioWelcomeAnimatedCard from './LexioWelcomeAnimatedCard';

const PARTICLE_COUNT = 18;
const TILE_COUNT = 5;

type LexioLoadingOverlayProps = {
  /** 씬 에셋(GLB)이 모두 로드되어 테이블을 그릴 준비가 됐는지 */
  ready: boolean;
  /** 페이드 아웃이 끝나 오버레이가 완전히 사라질 때 */
  onDismissed?: () => void;
};

/** 로딩이 빨리 끝나도 최소 이 시간만큼은 로딩 화면 유지 */
const MIN_VISIBLE_MS = 2000;
/** 페이드 아웃 길이 */
const FADE_OUT_MS = 650;
/** 진행 바가 천천히 차는 데 걸리는 시간 */
const BAR_FILL_MS = 2600;
const BAR_START = 6;
const BAR_MAX_BEFORE_LEAVE = 94;

/**
 * 게임 시작 직후 3D 테이블 에셋이 로드될 때까지 덮어두는 로딩 화면.
 * 온라인 웰컴 오버레이와 동일한 비주얼 언어(비네트·오브·카드)를 사용한다.
 */
export default function LexioLoadingOverlay({
  ready,
  onDismissed,
}: LexioLoadingOverlayProps) {
  const { progress: assetProgress } = useProgress();
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [displayPct, setDisplayPct] = useState(BAR_START);
  const shownAtRef = useRef(Date.now());
  const barStartRef = useRef(performance.now());
  const onDismissedRef = useRef(onDismissed);
  onDismissedRef.current = onDismissed;

  // 시간 기반으로 천천히 채움. useProgress는 상한만 참고(빠르게 끝나도 바가 앞서지 않음)
  useEffect(() => {
    let raf = 0;
    const step = (now: number) => {
      const elapsed = now - barStartRef.current;
      const timeRatio = Math.min(1, elapsed / BAR_FILL_MS);
      const eased = 1 - (1 - timeRatio) ** 2.4;
      const timePct =
        BAR_START + (BAR_MAX_BEFORE_LEAVE - BAR_START) * eased;

      let target: number;
      if (leaving) {
        target = 100;
      } else if (ready) {
        target = BAR_MAX_BEFORE_LEAVE;
      } else {
        const assetCap = Math.min(
          BAR_MAX_BEFORE_LEAVE,
          Math.max(BAR_START, assetProgress),
        );
        target = Math.min(timePct, assetCap);
      }

      setDisplayPct((prev) => {
        if (Math.abs(prev - target) < 0.25) return target;
        return prev + (target - prev) * 0.04;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [assetProgress, ready, leaving]);

  const pct = Math.round(displayPct);

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - shownAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const leaveTimer = window.setTimeout(() => setLeaving(true), wait);
    const unmountTimer = window.setTimeout(() => {
      setMounted(false);
      onDismissedRef.current?.();
    }, wait + FADE_OUT_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [ready]);

  if (!mounted) return null;

  return (
    <div
      className={`lexio-welcome-overlay lexio-loading-overlay pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center px-4${
        leaving ? ' lexio-welcome-leaving' : ''
      }`}
      aria-live="polite"
      aria-busy={!ready}
      aria-label="렉시오에 오신 것을 환영합니다"
    >
      <div className="lexio-welcome-vignette" aria-hidden />

      <div className="lexio-welcome-orbs" aria-hidden>
        <span className="lexio-welcome-orb lexio-welcome-orb-a" />
        <span className="lexio-welcome-orb lexio-welcome-orb-b" />
        <span className="lexio-welcome-orb lexio-welcome-orb-c" />
      </div>

      <div className="lexio-welcome-particles" aria-hidden>
        {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
          <span
            key={i}
            className="lexio-welcome-particle"
            style={{ '--particle-i': i } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="lexio-loading-stage">
        <div className="lexio-loading-tiles" aria-hidden>
          {Array.from({ length: TILE_COUNT }, (_, i) => (
            <span
              key={i}
              className="lexio-loading-tile"
              style={{ '--tile-i': i } as React.CSSProperties}
            />
          ))}
        </div>

        <LexioWelcomeAnimatedCard
          subtitle="Welcome to Lexio"
          title="렉시오에 오신 것을 환영합니다"
        />

        <div className="lexio-loading-progress" aria-hidden>
          <div className="lexio-loading-progress-track">
            <div
              className="lexio-loading-progress-fill"
              style={{ width: `${pct}%` }}
            />
            {!leaving && <span className="lexio-loading-progress-shine" />}
          </div>
        </div>
      </div>
    </div>
  );
}
