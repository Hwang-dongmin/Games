import { useCallback, useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '../ui/utils';
import { startHomeBgm } from '../../utils/homeBgm';
import {
  isLexioSfxMuted,
  setLexioSfxMuted,
  unlockLexioAudio,
} from '../../utils/lexioSounds';

export default function HomeSfxToggle() {
  const [muted, setMuted] = useState(() => isLexioSfxMuted());

  useEffect(() => {
    setMuted(isLexioSfxMuted());
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setLexioSfxMuted(next);
    if (!next) {
      unlockLexioAudio();
      startHomeBgm();
    }
  }, [muted]);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!muted}
      aria-label={muted ? '배경음 켜기' : '배경음 끄기'}
      onClick={toggleMute}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl ring-1 transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70',
        muted
          ? 'bg-white/[0.04] text-zinc-500 ring-white/10 hover:text-zinc-300'
          : 'bg-violet-500/15 text-violet-200 ring-violet-400/25 hover:bg-violet-500/20',
      )}
    >
      {muted ? (
        <VolumeX className="h-4 w-4" strokeWidth={2.25} />
      ) : (
        <Volume2 className="h-4 w-4" strokeWidth={2.25} />
      )}
    </button>
  );
}
