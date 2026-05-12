import { Sun, Moon, Star, Cloud, type LucideIcon } from 'lucide-react';
import type { LexioColor } from '../../utils/lexio';

export type LexioPlaySuit = 'sun' | 'moon' | 'star' | 'cloud';

/** 이집트 상형문자 (Unicode Egyptian Hieroglyphs) — 해·달·별·하늘/물안개 */
const H = {
  /** N005 태양 원반 */
  sun: '\u{131F3}',
  /** D010 라의 눈 (태양과 연관) */
  sunDetail: '\u{13080}',
  /** N011 초승달 */
  moon: '\u{131F9}',
  /** N015 초승달 변형 */
  moonDetail: '\u{131FD}',
  /** N014 별 */
  star: '\u{131FC}',
  /** N013 별(점) 변형 */
  starDetail: '\u{131FB}',
  /** N002 하늘 */
  sky: '\u{131EF}',
  /** N25 물 (구름·비와 연상) */
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
    /** 큰 숫자 — 카드 본인 색(홍·녹·황·청 대응) */
    numberClass: string;
  }
> = {
  sun: {
    Icon: Sun,
    glyph: H.sun,
    label: H.sunDetail,
    iconClass: 'text-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.55)]',
    glyphClass: 'text-red-400/90',
    numberClass:
      'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.45)]',
  },
  moon: {
    Icon: Moon,
    glyph: H.moon,
    label: H.moonDetail,
    iconClass: 'text-emerald-500 drop-shadow-[0_0_6px_rgba(16,185,129,0.45)]',
    glyphClass: 'text-emerald-400/90',
    numberClass:
      'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]',
  },
  star: {
    Icon: Star,
    glyph: H.star,
    label: H.starDetail,
    iconClass: 'text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)]',
    glyphClass: 'text-amber-300/90',
    numberClass:
      'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)]',
  },
  cloud: {
    Icon: Cloud,
    glyph: H.sky,
    label: H.skyDetail,
    iconClass: 'text-blue-500 drop-shadow-[0_0_6px_rgba(59,130,246,0.5)]',
    glyphClass: 'text-blue-400/90',
    numberClass:
      'text-blue-500 drop-shadow-[0_0_10px_rgba(59,130,246,0.45)]',
  },
};

/** 렉시오 색 → 문양 (홍·녹·황·청) */
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
  /** 3D 등에서 메시 호버와 동기화할 때 true */
  isHovered?: boolean;
  /** 판 종료 공개 시 숫자 2 패 후광 */
  numberTwoHalo?: boolean;
};

/**
 * 이미지 없이 Tailwind + Lucide만으로 그린 렉시오 패 카드.
 * 상단: 큰 숫자 / 하단: Lucide 문양 + 이집트 상형문자(주·보조)
 */
export function LexioPlayCard({
  number,
  suit,
  className = '',
  small = false,
  isHovered = false,
  numberTwoHalo = false,
}: LexioPlayCardProps) {
  const { Icon, glyph, label, iconClass, glyphClass, numberClass } =
    SUIT_CONFIG[suit];
  const numCls = small
    ? 'text-xl font-black tabular-nums tracking-tight'
    : 'text-3xl font-black tabular-nums tracking-tight';

  const hoverLift =
    'transition-[transform,box-shadow,border-color] duration-200 ease-out will-change-transform';
  const hoverCss =
    'hover:-translate-y-1 hover:scale-[1.05] hover:border-purple-400/45 hover:shadow-[0_14px_32px_-10px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]';
  const forcedHover =
    '-translate-y-1 scale-[1.05] border-purple-400/55 shadow-[0_14px_32px_-10px_rgba(88,28,135,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]';

  const twoHalo =
    numberTwoHalo &&
    'z-[2] border-amber-400/60 ring-2 ring-amber-300/90 shadow-[0_0_16px_3px_rgba(251,191,36,0.85),0_0_36px_10px_rgba(252,211,77,0.35)]';

  return (
    <div
      className={[
        'relative flex flex-col justify-between overflow-hidden rounded-lg',
        'bg-neutral-950',
        'border border-neutral-800/90',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-2px_0_rgba(0,0,0,0.45),0_2px_0_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.75)]',
        'aspect-[57/89]',
        small ? 'w-[3.1rem] px-1.5 py-1' : 'w-[4rem] px-2 py-1.5',
        hoverLift,
        isHovered ? forcedHover : hoverCss,
        twoHalo,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.07]',
          'bg-[radial-gradient(ellipse_at_30%_15%,#fff_0%,transparent_55%)]',
        ].join(' ')}
        aria-hidden
      />
      <span
        className={`relative z-[1] leading-none ${numCls} ${numberClass}`}
      >
        {number}
      </span>
      <div className="relative z-[1] flex items-end justify-between gap-0.5">
        <Icon
          className={[
            small ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0',
            iconClass,
          ].join(' ')}
          strokeWidth={2.25}
          aria-hidden
        />
        <div className="min-w-0 text-right">
          <span
            className={[
              'block leading-none',
              small ? 'text-[13px]' : 'text-base',
              glyphClass,
            ].join(' ')}
            style={{ fontFamily: HIERO_FONT }}
          >
            {glyph}
          </span>
          <span
            className={[
              'mt-0.5 block text-[9px] font-medium leading-none text-neutral-400',
              small ? 'scale-95 origin-bottom-right' : '',
            ].join(' ')}
            style={{ fontFamily: HIERO_FONT }}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
