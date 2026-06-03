import React from 'react';
import LexioWelcomeAnimatedCard from './LexioWelcomeAnimatedCard';

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

      <LexioWelcomeAnimatedCard
        subtitle="Welcome to Lexio"
        title="렉시오에 오신 걸 환영합니다"
      />
    </div>
  );
}
