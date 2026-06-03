import { Sun, Moon, Star, Cloud, type LucideIcon } from 'lucide-react';
import type { LexioColor } from '../../utils/lexio';

export type LexioPlaySuit = 'sun' | 'moon' | 'star' | 'cloud';

/** 3D 패 앞면 — 상형문자·색상·워터마크 아이콘 (쨍한 채도) */
export const LEXIO_SUIT_FACE = {
  sun: {
    color: '#ff2a2a',
    glow: '#ff8a8a',
    accent: '#ff5252',
    glyph: '\u{131F3}',
    label: '\u{13080}',
    mark: '☀',
    watermark: '☀',
  },
  moon: {
    color: '#00e676',
    glow: '#66ffb2',
    accent: '#00ff9d',
    glyph: '\u{131F9}',
    label: '\u{131FD}',
    mark: '☽',
    watermark: '☽',
  },
  star: {
    color: '#ffd400',
    glow: '#fff44d',
    accent: '#ffeb3b',
    glyph: '\u{131FC}',
    label: '\u{131FB}',
    mark: '★',
    watermark: '★',
  },
  cloud: {
    color: '#1e90ff',
    glow: '#7ec8ff',
    accent: '#42a5ff',
    glyph: '\u{131EF}',
    label: '\u{13217}',
    mark: '☁',
    watermark: '☁',
  },
} as const;

/** 숫자 2 패면 — 십자선 색 (테두리는 face.color / face.accent 인라인) */
const FANCY_TWO_FRAME: Record<LexioPlaySuit, { line: string }> = {
  sun: { line: 'bg-[#ff3030]/80' },
  moon: { line: 'bg-[#00e676]/80' },
  star: { line: 'bg-[#ffd400]/80' },
  cloud: { line: 'bg-[#1e90ff]/80' },
};

/** 숫자 윤곽 — 기본 대비 1.5배 굵기 (2번 패는 크기에 비례) */
const numberStrokeStyle = (fancy: boolean) =>
  ({
    WebkitTextStroke: fancy ? '1.125px currentColor' : '0.75px currentColor',
    paintOrder: 'stroke fill',
  }) as const;

const H = {
  sun: '\u{131F3}',
  sunDetail: '\u{13080}',
  moon: '\u{131F9}',
  moonDetail: '\u{131FD}',
  star: '\u{131FC}',
  starDetail: '\u{131FB}',
  sky: '\u{131EF}',
  skyDetail: '\u{13217}',
} as const;

const HIERO_FONT =
  '"Noto Sans Egyptian Hieroglyphs", "Segoe UI Historic", "Noto Sans Symbols 2", serif';

const SUIT_CONFIG: Record<
  LexioPlaySuit,
  {
    Icon: LucideIcon;
    glyph: string;
    label: string;
    iconClass: string;
    glyphClass: string;
    numberClass: string;
  }
> = {
  sun: {
    Icon: Sun,
    glyph: H.sun,
    label: H.sunDetail,
    iconClass: 'text-[#ff2a2a] drop-shadow-[0_0_8px_rgba(255,42,42,0.65)]',
    glyphClass:
      'text-transparent [-webkit-text-stroke:0.85px_rgba(255,82,82,0.55)]',
    numberClass:
      'text-[#ff2a2a] drop-shadow-[0_0_12px_rgba(255,42,42,0.55)]',
  },
  moon: {
    Icon: Moon,
    glyph: H.moon,
    label: H.moonDetail,
    iconClass: 'text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]',
    glyphClass:
      'text-transparent [-webkit-text-stroke:0.85px_rgba(0,255,157,0.55)]',
    numberClass:
      'text-[#00e676] drop-shadow-[0_0_12px_rgba(0,230,118,0.55)]',
  },
  star: {
    Icon: Star,
    glyph: H.star,
    label: H.starDetail,
    iconClass: 'text-[#ffd400] drop-shadow-[0_0_8px_rgba(255,212,0,0.65)]',
    glyphClass:
      'text-transparent [-webkit-text-stroke:0.85px_rgba(255,235,59,0.55)]',
    numberClass:
      'text-[#ffd400] drop-shadow-[0_0_12px_rgba(255,212,0,0.55)]',
  },
  cloud: {
    Icon: Cloud,
    glyph: H.sky,
    label: H.skyDetail,
    iconClass: 'text-[#1e90ff] drop-shadow-[0_0_8px_rgba(30,144,255,0.6)]',
    glyphClass:
      'text-transparent [-webkit-text-stroke:0.85px_rgba(66,165,255,0.55)]',
    numberClass:
      'text-[#1e90ff] drop-shadow-[0_0_12px_rgba(30,144,255,0.55)]',
  },
};

export function lexioColorToSuit(color: LexioColor): LexioPlaySuit {
  const map: Record<LexioColor, LexioPlaySuit> = {
    red: 'sun',
    green: 'moon',
    yellow: 'star',
    blue: 'cloud',
  };
  return map[color];
}

type LexioPlayCardProps = {
  number: number;
  suit: LexioPlaySuit;
  className?: string;
  small?: boolean;
  rulesTight?: boolean;
  isHovered?: boolean;
  embed3D?: boolean;
};

export function LexioPlayCard({
  number,
  suit,
  className = '',
  small = false,
  rulesTight = false,
  isHovered = false,
  embed3D = false,
}: LexioPlayCardProps) {
  const face = LEXIO_SUIT_FACE[suit];
  const frame = FANCY_TWO_FRAME[suit];
  const isFancyTwo = number === 2;
  const { Icon, glyph, label, iconClass, glyphClass, numberClass } =
    SUIT_CONFIG[suit];
  const tight = small && rulesTight;
  const numCls = small
    ? tight
      ? 'text-[18px] font-black tabular-nums tracking-tight'
      : 'text-xl font-black tabular-nums tracking-tight'
    : 'text-3xl font-black tabular-nums tracking-tight';
  const numWide = number >= 10;
  const numDiscCls = small
    ? tight
      ? numWide
        ? 'h-[1.6rem] w-[2.2rem]'
        : 'h-[1.6rem] w-[1.6rem]'
      : numWide
        ? 'h-[1.75rem] w-[2.3rem]'
        : 'h-[1.75rem] w-[1.75rem]'
    : numWide
      ? 'h-[2.05rem] w-[2.7rem]'
      : 'h-[2.05rem] w-[2.05rem]';

  const hoverLift =
    'transition-[transform,box-shadow,border-color] duration-200 ease-out will-change-transform';
  const hoverCss2D =
    'hover:-translate-y-1 hover:scale-[1.05] hover:border-purple-400/45 hover:shadow-[0_14px_32px_-10px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]';
  const forcedHover2D =
    '-translate-y-1 scale-[1.05] border-purple-400/55 shadow-[0_14px_32px_-10px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]';
  const forcedHover3D =
    'scale-[1.03] border-purple-400/55 shadow-[0_14px_32px_-10px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]';

  const hoverStyle = embed3D
    ? isHovered
      ? forcedHover3D
      : ''
    : isHovered
      ? forcedHover2D
      : hoverCss2D;

  const fancyNumCls = small
    ? tight
      ? 'text-[19px] font-black tabular-nums tracking-tight'
      : 'text-[20px] font-black tabular-nums tracking-tight'
    : 'text-[1.95rem] font-black tabular-nums tracking-tight';
  const numDiscBorderCls = small ? 'border-[4.5px]' : 'border-[6px]';
  const numDiscBorderStyle = { borderColor: face.color } as const;
  const fancyNumDiscCls = small
    ? tight
      ? 'h-[1.45rem] w-[1.45rem]'
      : 'h-[1.55rem] w-[1.55rem]'
    : 'h-[1.85rem] w-[1.85rem]';

  return (
    <div
      className={[
        'relative rounded-lg',
        isFancyTwo
          ? 'bg-neutral-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_0_rgba(0,0,0,0.5),0_2px_0_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.75)]'
          : 'bg-neutral-950 border border-neutral-800/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-2px_0_rgba(0,0,0,0.45),0_2px_0_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.75)]',
        tight ? 'aspect-[57/79]' : 'aspect-[57/89]',
        small
          ? tight
            ? 'w-[3.1rem]'
            : 'w-[3.1rem]'
          : 'w-[4rem]',
        hoverLift,
        hoverStyle,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'relative h-full w-full overflow-hidden rounded-[inherit]',
          isFancyTwo ? 'flex flex-col justify-center' : 'flex flex-col justify-between',
          small
            ? tight
              ? 'px-1.5 py-1.5'
              : 'px-1.5 py-1'
            : 'px-2 py-1.5',
        ].join(' ')}
      >
      {isFancyTwo ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] border-[3px] border-solid"
            style={{ borderColor: face.color }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background: `radial-gradient(ellipse at 50% 40%, ${face.color}22 0%, transparent 65%)`,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-[6px] z-[1]"
            aria-hidden
          >
            <div
              className="absolute inset-0 rounded-[4px] border-[2.5px] border-solid box-border"
              style={{ borderColor: face.accent }}
            />
            <div className="absolute inset-[3px] overflow-hidden rounded-[3px]">
            <div
              className={`absolute left-0 right-0 top-1/2 h-[10.5px] -translate-y-1/2 ${frame.line}`}
            />
            <div
              className={`absolute bottom-0 top-0 left-1/2 w-[10.5px] -translate-x-1/2 ${frame.line}`}
            />
            <div
              className={`absolute left-1/2 top-1/2 h-[10.5px] w-[106%] -translate-x-1/2 -translate-y-1/2 rotate-[19deg] ${frame.line} opacity-60`}
            />
            <div
              className={`absolute left-1/2 top-1/2 h-[10.5px] w-[106%] -translate-x-1/2 -translate-y-1/2 -rotate-[19deg] ${frame.line} opacity-60`}
            />
            <div
              className={`absolute left-1/2 top-1/2 h-[10.5px] w-[128%] -translate-x-1/2 -translate-y-1/2 rotate-[38deg] ${frame.line}`}
            />
            <div
              className={`absolute left-1/2 top-1/2 h-[10.5px] w-[128%] -translate-x-1/2 -translate-y-1/2 -rotate-[38deg] ${frame.line}`}
            />
            </div>
          </div>
        </>
      ) : (
        <div
          className={[
            'pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.07]',
            'bg-[radial-gradient(ellipse_at_30%_15%,#fff_0%,transparent_55%)]',
          ].join(' ')}
          aria-hidden
        />
      )}
      {isFancyTwo ? (
        <div
          className={`relative z-10 mx-auto flex shrink-0 items-center justify-center rounded-full border-solid bg-black ${numDiscBorderCls} ${fancyNumDiscCls}`}
          style={numDiscBorderStyle}
        >
          <span
            className={`leading-none ${fancyNumCls} ${numberClass} translate-y-[-0.5px]`}
            style={numberStrokeStyle(true)}
          >
            {number}
          </span>
        </div>
      ) : (
        <>
          <span className="relative z-[1] inline-flex -translate-x-px -translate-y-1.5 self-start">
            <div
              className={`flex shrink-0 items-center justify-center rounded-full border-solid bg-black ${numDiscBorderCls} ${numDiscCls}`}
              style={numDiscBorderStyle}
            >
              <span
                className={`leading-none ${numCls} ${numberClass} translate-y-[-0.5px]`}
                style={numberStrokeStyle(false)}
              >
                {number}
              </span>
            </div>
          </span>
          <div className="relative z-[1] flex items-end justify-between gap-0.5">
            <Icon
              className={[
                small
                  ? tight
                    ? 'h-3.5 w-3.5 shrink-0'
                    : 'h-4 w-4 shrink-0'
                  : 'h-5 w-5 shrink-0',
                iconClass,
              ].join(' ')}
              strokeWidth={2.25}
              aria-hidden
            />
            <div className="min-w-0 text-right">
              <span
                className={[
                  'block leading-none',
                  small
                    ? tight
                      ? 'text-[12px]'
                      : 'text-[13px]'
                    : 'text-base',
                  glyphClass,
                ].join(' ')}
                style={{ fontFamily: HIERO_FONT }}
              >
                {glyph}
              </span>
              <span
                className={[
                  'mt-0.5 block text-[9px] font-medium leading-none text-transparent [-webkit-text-stroke:0.5px_rgba(163,163,163,0.38)]',
                  small ? 'scale-95 origin-bottom-right' : '',
                ].join(' ')}
                style={{ fontFamily: HIERO_FONT }}
              >
                {label}
              </span>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
