import React from 'react';

const PARTICLE_COUNT = 18;

type LexioOnlineWelcomeOverlayProps = {
  leaving: boolean;
};

export default function LexioOnlineWelcomeOverlay({
  leaving,
}: LexioOnlineWelcomeOverlayProps) {
  return (
    <div
      className={`lexio-welcome-overlay pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-4 ${
        leaving ? 'lexio-welcome-leaving' : ''
      }`}
      aria-live="polite"
      aria-label="렉시오에 오신 걸 환영합니다"
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

      <div className="lexio-welcome-card">
        <span className="lexio-welcome-card-ring" aria-hidden />
        <span className="lexio-welcome-card-glow" aria-hidden />

        <div className="lexio-welcome-inner">
          <span className="lexio-welcome-line lexio-welcome-line-top" aria-hidden />
          <p className="lexio-welcome-subtitle">Welcome to Lexio</p>
          <h2 className="lexio-welcome-title">
            <span className="lexio-welcome-title-text">
              렉시오에 오신 걸 환영합니다
            </span>
          </h2>
          <span
            className="lexio-welcome-line lexio-welcome-line-bottom"
            aria-hidden
          />
        </div>

        <span className="lexio-welcome-shimmer" aria-hidden />
      </div>
    </div>
  );
}
