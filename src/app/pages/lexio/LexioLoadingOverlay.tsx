import React, { useEffect, useRef, useState } from 'react';
import { useProgress } from '@react-three/drei';
import LexioWelcomeAnimatedCard from './LexioWelcomeAnimatedCard';

const PARTICLE_COUNT = 18;
const TILE_COUNT = 5;

type LexioLoadingOverlayProps = {
  /** 씬 에셋(GLB)이 모두 로드되어 테이블을 그릴 준비가 됐는지 */
  ready: boolean;
};

/** 로딩 화면이 너무 짧게 깜빡이지 않도록 최소 노출 시간 */
const MIN_VISIBLE_MS = 700;
/** 페이드 아웃 길이 */
const FADE_OUT_MS = 650;

/**
 * 게임 시작 직후 3D 테이블 에셋이 로드될 때까지 덮어두는 로딩 화면.
 * 온라인 웰컴 오버레이와 동일한 비주얼 언어(비네트·오브·카드)를 사용한다.
 */
export default function LexioLoadingOverlay({ ready }: LexioLoadingOverlayProps) {
  const { progress } = useProgress();
  const [mounted, setMounted] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const shownAtRef = useRef(Date.now());

  const pct = ready ? 100 : Math.min(96, Math.max(4, Math.round(progress)));

  useEffect(() => {
    if (!ready) return;
    const elapsed = Date.now() - shownAtRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    const leaveTimer = window.setTimeout(() => setLeaving(true), wait);
    const unmountTimer = window.setTimeout(
      () => setMounted(false),
      wait + FADE_OUT_MS,
    );
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
            {!ready && <span className="lexio-loading-progress-shine" />}
          </div>
        </div>
      </div>
    </div>
  );
}
