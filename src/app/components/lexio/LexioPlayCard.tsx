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

type SuitFace = (typeof LEXIO_SUIT_FACE)[LexioPlaySuit];

/** 3D FancyTwoCardFace와 동일 비율 — 클립·대각 길이·선 굵기 */
function fancyTwoClipMetrics(tight: boolean) {
  const cardW = 57;
  const cardH = tight ? 79 : 89;
  const clipW = cardW * 0.86 * 0.96;
  const clipH = cardH * 0.9 * 0.96;
  const lineTh = cardW * 0.0555;
  const diagAngle = Math.atan2(clipH, clipW);
  const halfDiagAngle = diagAngle / 2;

  const diagLenAt = (angle: number) => {
    const c = Math.abs(Math.cos(angle));
    const s = Math.abs(Math.sin(angle));
    if (c < 1e-5) return clipH;
    if (s < 1e-5) return clipW;
    return Math.min(clipW / c, clipH / s);
  };

  return { clipW, clipH, lineTh, diagAngle, halfDiagAngle, diagLenAt };
}

function FancyTwoCrossLines2D({
  color,
  tight,
}: {
  color: string;
  tight: boolean;
}) {
  const { clipW, clipH, lineTh, diagAngle, halfDiagAngle, diagLenAt } =
    fancyTwoClipMetrics(tight);
  const cx = clipW / 2;
  const cy = clipH / 2;

  const diagLine = (angle: number, opacity: number) => {
    const len = diagLenAt(angle);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return (
      <line
        key={angle}
        x1={cx - (len / 2) * cos}
        y1={cy - (len / 2) * sin}
        x2={cx + (len / 2) * cos}
        y2={cy + (len / 2) * sin}
        stroke={color}
        strokeWidth={lineTh}
        strokeOpacity={opacity}
      />
    );
  };

  return (
    <svg
      viewBox={`0 0 ${clipW} ${clipH}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1={0}
        y1={cy}
        x2={clipW}
        y2={cy}
        stroke={color}
        strokeWidth={lineTh}
        strokeOpacity={0.72}
      />
      <line
        x1={cx}
        y1={0}
        x2={cx}
        y2={clipH}
        stroke={color}
        strokeWidth={lineTh}
        strokeOpacity={0.72}
      />
      {diagLine(halfDiagAngle, 0.58)}
      {diagLine(-halfDiagAngle, 0.58)}
      {diagLine(diagAngle, 0.72)}
      {diagLine(-diagAngle, 0.72)}
    </svg>
  );
}

/** 동그라미 테두리 굵기 (기본 대비 0.6배) */
const NUM_DISC_BORDER_SCALE = 0.6;
/** 숫자 윤곽 굵기 (기본 대비 0.55배) */
const NUM_TEXT_STROKE_SCALE = 0.55;

const numberStrokeStyle = (fancy: boolean) =>
  ({
    WebkitTextStroke: fancy
      ? `${1.125 * NUM_TEXT_STROKE_SCALE}px currentColor`
      : `${0.75 * NUM_TEXT_STROKE_SCALE}px currentColor`,
    paintOrder: 'stroke fill',
  }) as const;

const CARD_FACE_SHELL_CLS =
  'relative isolate overflow-hidden rounded-lg [overflow:clip]';

const SUIT_CONFIG: Record<
  LexioPlaySuit,
  {
    Icon: LucideIcon;
    iconClass: string;
    numberClass: string;
  }
> = {
  sun: {
    Icon: Sun,
    iconClass: 'text-[#ff2a2a] drop-shadow-[0_0_8px_rgba(255,42,42,0.65)]',
    numberClass: 'text-[#ff2a2a]',
  },
  moon: {
    Icon: Moon,
    iconClass: 'text-[#00e676] drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]',
    numberClass: 'text-[#00e676]',
  },
  star: {
    Icon: Star,
    iconClass: 'text-[#ffd400] drop-shadow-[0_0_8px_rgba(255,212,0,0.65)]',
    numberClass: 'text-[#ffd400]',
  },
  cloud: {
    Icon: Cloud,
    iconClass: 'text-[#1e90ff] drop-shadow-[0_0_8px_rgba(30,144,255,0.6)]',
    numberClass: 'text-[#1e90ff]',
  },
};

/** 3D buildCloudShape과 동일한 실루엣 — viewBox 기준 s=100 */
const CLOUD_WATERMARK_PATH =
  'M -94 -20 L 98 -20 C 112 -20 114 34 58 44 C 48 78 2 86 -20 56 C -62 90 -112 58 -102 10 C -110 -12 -98 -20 -94 -20 Z';

function CloudWatermark2D({ face }: { face: SuitFace }) {
  return (
    <svg
      viewBox="-120 -90 240 180"
      className="h-[68%] w-[68%] shrink-0"
      aria-hidden
    >
      <path
        d={CLOUD_WATERMARK_PATH}
        fill="none"
        stroke={face.color}
        strokeWidth={5.5}
        strokeLinejoin="round"
        opacity={0.48}
      />
    </svg>
  );
}

const MOON_WATERMARK_R = 38;
/** 초승달 — 시계 20° (SVG rotate 양수 = 시계방향) */
const MOON_CRESCENT_ROT_DEG = 20;
const MOON_CRESCENT_SIZE = MOON_WATERMARK_R * 1.38;
const MOON_CRESCENT_FONT =
  '"Noto Sans Symbols 2", "Segoe UI Symbol", "Segoe UI Historic", sans-serif';

function MoonWatermark2D({ face }: { face: SuitFace }) {
  const cx = MOON_WATERMARK_R * 0.36;
  const cy = MOON_WATERMARK_R * 0.28;

  return (
    <svg
      viewBox="-50 -50 100 100"
      className="h-[68%] w-[68%] shrink-0 overflow-visible"
      aria-hidden
    >
      <circle
        cx={0}
        cy={0}
        r={MOON_WATERMARK_R}
        fill="none"
        stroke={face.color}
        strokeWidth={3.5}
        opacity={0.48}
      />
      <g transform={`translate(${cx} ${cy}) rotate(${MOON_CRESCENT_ROT_DEG})`}>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="none"
          stroke={face.glow}
          strokeWidth={MOON_CRESCENT_SIZE * 0.075}
          strokeOpacity={0.38}
          fontSize={MOON_CRESCENT_SIZE}
          style={{ fontFamily: MOON_CRESCENT_FONT }}
        >
          {face.mark}
        </text>
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={face.color}
          fontSize={MOON_CRESCENT_SIZE}
          style={{ fontFamily: MOON_CRESCENT_FONT }}
        >
          {face.mark}
        </text>
      </g>
    </svg>
  );
}

function SymbolWatermark2D({
  Icon,
  face,
}: {
  Icon: LucideIcon;
  face: SuitFace;
}) {
  return (
    <div className="relative h-[68%] w-[68%] shrink-0" aria-hidden>
      <Icon
        className="absolute inset-0 h-full w-full"
        stroke={face.glow}
        fill="none"
        strokeWidth={2.75}
        style={{ opacity: 0.42 }}
      />
      <Icon
        className="absolute inset-0 h-full w-full"
        stroke={face.color}
        fill="none"
        strokeWidth={1.65}
        style={{ opacity: 0.55 }}
      />
    </div>
  );
}

function SuitBackgroundWatermark2D({
  suit,
  face,
}: {
  suit: LexioPlaySuit;
  face: SuitFace;
}) {
  const { Icon } = SUIT_CONFIG[suit];

  let mark;
  if (suit === 'cloud') {
    mark = <CloudWatermark2D face={face} />;
  } else if (suit === 'moon') {
    mark = <MoonWatermark2D face={face} />;
  } else {
    mark = <SymbolWatermark2D Icon={Icon} face={face} />;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
      style={{ transform: 'translate(-4.5%, 1%)' }}
      aria-hidden
    >
      {mark}
    </div>
  );
}

function SuitCornerMarkBottom2D({
  suit,
  face,
  small,
  tight,
  suitMarkPadCls,
}: {
  suit: LexioPlaySuit;
  face: SuitFace;
  small: boolean;
  tight: boolean;
  suitMarkPadCls: string;
}) {
  const { Icon, iconClass } = SUIT_CONFIG[suit];

  return (
    <div
      className={`pointer-events-none absolute z-[1] flex items-end justify-end ${suitMarkPadCls}`}
      aria-hidden
    >
      <SuitCornerMark2D
        Icon={Icon}
        iconClass={iconClass}
        face={face}
        small={small}
        tight={tight}
      />
    </div>
  );
}

function SuitCornerMark2D({
  Icon,
  iconClass,
  face,
  small,
  tight,
}: {
  Icon: LucideIcon;
  iconClass: string;
  face: SuitFace;
  small: boolean;
  tight: boolean;
}) {
  const sizeCls = small
    ? tight
      ? 'h-[15px] w-[15px]'
      : 'h-4 w-4'
    : 'h-5 w-5';

  return (
    <div className={`relative shrink-0 ${sizeCls}`} aria-hidden>
      <Icon
        className="absolute inset-0 h-full w-full"
        stroke={face.glow}
        fill="none"
        strokeWidth={3.25}
        style={{ opacity: 0.45 }}
      />
      <Icon
        className={['absolute inset-0 h-full w-full', iconClass].join(' ')}
        strokeWidth={2.25}
        fill={face.color}
        fillOpacity={0.92}
      />
      <Icon
        className="absolute inset-0 h-full w-full"
        stroke={face.color}
        fill="none"
        strokeWidth={1.35}
        style={{ opacity: 0.85 }}
      />
    </div>
  );
}

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
  const isFancyTwo = number === 2;
  const { numberClass } = SUIT_CONFIG[suit];
  const tight = small && rulesTight;
  const numWide = number >= 10;
  const numCls = small
    ? tight
      ? numWide
        ? 'text-[16px] font-black tabular-nums tracking-tight'
        : 'text-[18px] font-black tabular-nums tracking-tight'
      : numWide
        ? 'text-lg font-black tabular-nums tracking-tight'
        : 'text-xl font-black tabular-nums tracking-tight'
    : numWide
      ? 'text-[1.65rem] font-black tabular-nums tracking-tight'
      : 'text-3xl font-black tabular-nums tracking-tight';
  const numDiscCls = small
    ? tight
      ? numWide
        ? 'size-[1.85rem]'
        : 'size-[1.6rem]'
      : numWide
        ? 'size-[2rem]'
        : 'size-[1.75rem]'
    : numWide
      ? 'size-[2.35rem]'
      : 'size-[2.05rem]';

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
  const numDiscBorderWidth = small
    ? 4.5 * NUM_DISC_BORDER_SCALE
    : 6 * NUM_DISC_BORDER_SCALE;
  const numDiscBorderCls = 'border-solid';
  const numDiscBorderStyle = {
    borderColor: face.color,
    borderWidth: numDiscBorderWidth,
  } as const;
  const fancyNumDiscCls = small
    ? tight
      ? 'h-[1.45rem] w-[1.45rem]'
      : 'h-[1.55rem] w-[1.55rem]'
    : 'h-[1.85rem] w-[1.85rem]';
  const numDiscPosCls = small
    ? tight
      ? 'left-1.5 top-1.5'
      : 'left-1.5 top-1'
    : 'left-2 top-1.5';
  const suitMarkPadCls = small
    ? tight
      ? 'right-1.5 bottom-1.5'
      : 'right-1.5 bottom-1'
    : 'right-2 bottom-1.5';

  return (
    <div
      className={[
        CARD_FACE_SHELL_CLS,
        tight ? 'aspect-[57/79]' : 'aspect-[57/89]',
        small ? 'w-[3.1rem]' : 'w-[4rem]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded-[inherit]',
          isFancyTwo
            ? 'bg-neutral-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_0_rgba(0,0,0,0.5),0_2px_0_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.75)]'
            : 'bg-neutral-950 border border-neutral-800/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-2px_0_rgba(0,0,0,0.45),0_2px_0_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.75)]',
          hoverLift,
          hoverStyle,
        ].join(' ')}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
          {isFancyTwo ? (
            <div className="relative flex h-full flex-col justify-center px-1.5 py-1.5">
              <div
                className="pointer-events-none absolute inset-0 rounded-[inherit] border-[2px] border-solid"
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
                  className="absolute inset-0 rounded-[4px] border-[1.75px] border-solid box-border"
                  style={{ borderColor: face.accent }}
                />
                <div className="absolute inset-[3px] overflow-hidden rounded-[3px]">
                  <FancyTwoCrossLines2D color={face.color} tight={tight} />
                </div>
              </div>
              <div
                className={`relative z-10 mx-auto flex shrink-0 items-center justify-center rounded-full bg-black ${numDiscBorderCls} ${fancyNumDiscCls}`}
                style={numDiscBorderStyle}
              >
                <span
                  className={`leading-none ${fancyNumCls} ${numberClass} translate-y-[-0.5px]`}
                  style={numberStrokeStyle(true)}
                >
                  {number}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div
                className={[
                  'pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.07]',
                  'bg-[radial-gradient(ellipse_at_30%_15%,#fff_0%,transparent_55%)]',
                ].join(' ')}
                aria-hidden
              />
              <SuitBackgroundWatermark2D suit={suit} face={face} />
              <span
                className={`pointer-events-none absolute z-[2] inline-flex -translate-x-2 -translate-y-2 ${numDiscPosCls}`}
                aria-hidden
              >
                <div
                  className={`flex shrink-0 items-center justify-center rounded-full bg-black ${numDiscBorderCls} ${numDiscCls}`}
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
              <SuitCornerMarkBottom2D
                suit={suit}
                face={face}
                small={small}
                tight={tight}
                suitMarkPadCls={suitMarkPadCls}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
