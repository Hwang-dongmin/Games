import { Layers, Users } from 'lucide-react';
import type { PlayMode } from '../../data/games';

type PlayModeToggleProps = {
  mode: PlayMode;
  onChange: (mode: PlayMode) => void;
};

const options = [
  { value: 'offline' as const, label: '오프라인', Icon: Layers },
  { value: 'online' as const, label: '온라인', Icon: Users },
];

export default function PlayModeToggle({ mode, onChange }: PlayModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="플레이 모드"
      className="relative inline-flex rounded-xl bg-white/[0.05] p-1 ring-1 ring-white/10 backdrop-blur-sm"
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.65)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          mode === 'online' ? 'translate-x-full' : 'translate-x-0',
        ].join(' ')}
      />

      {options.map(({ value, label, Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={[
              'relative z-[1] flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-200',
              active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
