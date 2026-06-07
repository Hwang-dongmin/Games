import { Layers, Users } from 'lucide-react';
import type { PlayMode } from '../data/games';

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
      className="relative grid w-full max-w-[17.5rem] grid-cols-2 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-inset ring-white/10 backdrop-blur-md sm:max-w-[18.5rem]"
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-xl bg-white shadow-[0_2px_16px_-2px_rgba(0,0,0,0.35)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
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
              'relative z-[1] flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 sm:gap-2 sm:px-4 sm:py-3',
              active ? 'text-slate-900' : 'text-white/55 hover:text-white/85',
            ].join(' ')}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
