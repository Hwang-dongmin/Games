import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Slider } from '../ui/slider';
import { cn } from '../ui/utils';
import { setLexioBgmMode } from '../../utils/lexioBgm';
import {
  getLexioSfxVolume,
  isLexioSfxMuted,
  playLexioSound,
  setLexioSfxMuted,
  setLexioSfxVolume,
  unlockLexioAudio,
} from '../../utils/lexioSounds';

type LexioSfxToggleProps = {
  className?: string;
};

export default function LexioSfxToggle({ className }: LexioSfxToggleProps) {
  const [muted, setMuted] = useState(() => isLexioSfxMuted());
  const [volumePct, setVolumePct] = useState(() =>
    Math.round(getLexioSfxVolume() * 100),
  );
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMuted(isLexioSfxMuted());
    setVolumePct(Math.round(getLexioSfxVolume() * 100));
  }, []);

  const schedulePreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      if (!isLexioSfxMuted()) playLexioSound('tileSelect');
    }, 140);
  }, []);

  useEffect(
    () => () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    },
    [],
  );

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setLexioSfxMuted(next);
    if (!next) {
      unlockLexioAudio();
      playLexioSound('tileSelect');
      setLexioBgmMode('playing');
    }
  };

  const onVolumeChange = (values: number[]) => {
    const pct = values[0] ?? 0;
    setVolumePct(pct);
    setLexioSfxVolume(pct / 100);
    if (!muted && pct > 0) schedulePreview();
  };

  return (
    <div className={cn('rounded-lg px-3 py-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
              muted
                ? 'bg-white/[0.05] text-purple-400/45'
                : 'bg-purple-500/15 text-purple-200',
            )}
            aria-hidden
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-purple-50">소리</p>
            {!muted && (
              <p className="text-xs text-purple-300/55">
                효과음 · 배경음 {volumePct}%
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={!muted}
          aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
          onClick={toggleMute}
          className={cn(
            'relative h-7 w-12 shrink-0 rounded-full transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#13111f]',
            muted ? 'bg-white/10' : 'bg-purple-600',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200',
              muted ? 'translate-x-0' : 'translate-x-5',
            )}
          />
        </button>
      </div>

      <div
        className={cn(
          'mt-3 space-y-2 transition-opacity',
          muted ? 'pointer-events-none opacity-40' : 'opacity-100',
        )}
      >
        <Slider
          value={[volumePct]}
          onValueChange={onVolumeChange}
          min={0}
          max={100}
          step={5}
          disabled={muted}
          aria-label="효과음 크기"
          className={cn(
            'w-full [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:rounded-full',
            '[&_[data-slot=slider-track]]:bg-white/10',
            '[&_[data-slot=slider-range]]:rounded-full [&_[data-slot=slider-range]]:bg-purple-500',
            '[&_[data-slot=slider-thumb]]:size-3.5',
            '[&_[data-slot=slider-thumb]]:border-0 [&_[data-slot=slider-thumb]]:bg-purple-100',
            '[&_[data-slot=slider-thumb]]:shadow-none',
            '[&_[data-slot=slider-thumb]]:hover:ring-2 [&_[data-slot=slider-thumb]]:hover:ring-purple-400/40',
          )}
        />
        <div className="flex justify-between text-[10px] text-purple-400/50">
          <span>작게</span>
          <span>크게</span>
        </div>
      </div>
    </div>
  );
}
