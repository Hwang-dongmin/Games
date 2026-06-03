import { useEffect, useRef } from 'react';

const COLORS = [
  '#ff6b6b',
  '#ffd93d',
  '#6bcb77',
  '#4d96ff',
  '#c56cf0',
  '#ff9ff3',
  '#feca57',
  '#48dbfb',
  '#a29bfe',
  '#fd79a8',
];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  color: string;
  size: number;
};

type Rocket = {
  x: number;
  y: number;
  vy: number;
  targetY: number;
  color: string;
};

function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function spawnExplosion(x: number, y: number, color: string, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      alpha: 1,
      decay: 0.012 + Math.random() * 0.018,
      color: Math.random() > 0.35 ? color : randomColor(),
      size: 1.5 + Math.random() * 2,
    });
  }
  return particles;
}

type LexioVictoryFireworksProps = {
  active: boolean;
};

export default function LexioVictoryFireworks({ active }: LexioVictoryFireworksProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const rockets: Rocket[] = [];
    const particles: Particle[] = [];
    let launchTimer = 0;
    let startTime = 0;
    let lastTime = 0;
    const DURATION_MS = 8000;

    const launchRocket = () => {
      rockets.push({
        x: width * (0.15 + Math.random() * 0.7),
        y: height,
        vy: -(6 + Math.random() * 4),
        targetY: height * (0.15 + Math.random() * 0.35),
        color: randomColor(),
      });
    };

    launchRocket();
    launchRocket();

    const tick = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
        lastTime = timestamp;
      }

      const dt = Math.min(timestamp - lastTime, 32);
      lastTime = timestamp;

      if (timestamp - startTime > DURATION_MS) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      launchTimer += dt;
      if (launchTimer > 420 + Math.random() * 380) {
        launchRocket();
        launchTimer = 0;
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.y += r.vy;
        r.vy *= 0.985;

        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = r.color;
        ctx.globalAlpha = 0.9;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x, r.y + 14);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (r.y <= r.targetY || r.vy > -0.5) {
          particles.push(
            ...spawnExplosion(r.x, r.y, r.color, 48 + Math.floor(Math.random() * 24)),
          );
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.vx *= 0.985;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[15]"
      aria-hidden
    />
  );
}
