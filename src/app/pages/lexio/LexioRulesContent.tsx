import React from 'react';
import { ChevronDown, Crown } from 'lucide-react';
import { LexioPlayCard } from '../../components/lexio/LexioPlayCard';
import { COLOR_HEX, lexioRulesLabelForPlayerCount } from '../../utils/lexio';

/** 전판 최약 타일: 파 3 — 안내·규칙 문구 통일 */
const LOWEST_TILE_LABEL = '파 3';

const LEXIO_RULES_COMBOS_1_3 = [
  {
    name: '싱글',
    text: '타일 1장',
    cards: [{ n: 7, s: 'moon' as const }],
  },
  {
    name: '페어',
    text: '같은 숫자 2장',
    cards: [
      { n: 8, s: 'cloud' as const },
      { n: 8, s: 'star' as const },
    ],
  },
  {
    name: '트리플',
    text: '같은 숫자 3장',
    cards: [
      { n: 11, s: 'cloud' as const },
      { n: 11, s: 'star' as const },
      { n: 11, s: 'moon' as const },
    ],
  },
] as const;

const LEXIO_RULES_COMBOS_5 = [
  {
    name: '스트레이트',
    text: '5장 연속 숫자(강도 기준 연속, 색 무관)',
    cards: [
      { n: 5, s: 'cloud' as const },
      { n: 6, s: 'sun' as const },
      { n: 7, s: 'moon' as const },
      { n: 8, s: 'cloud' as const },
      { n: 9, s: 'sun' as const },
    ],
  },
  {
    name: '플러시',
    text: '같은 색 5장(연속이 아니어도 됨)',
    cards: [
      { n: 5, s: 'cloud' as const },
      { n: 8, s: 'cloud' as const },
      { n: 10, s: 'cloud' as const },
      { n: 13, s: 'cloud' as const },
      { n: 1, s: 'cloud' as const },
    ],
  },
  {
    name: '풀하우스',
    text: '트리플 + 페어',
    cards: [
      { n: 12, s: 'cloud' as const },
      { n: 12, s: 'star' as const },
      { n: 12, s: 'moon' as const },
      { n: 6, s: 'moon' as const },
      { n: 6, s: 'star' as const },
    ],
  },
  {
    name: '포카드',
    text: '같은 숫자 4장 + 아무 1장',
    cards: [
      { n: 10, s: 'cloud' as const },
      { n: 10, s: 'star' as const },
      { n: 10, s: 'moon' as const },
      { n: 10, s: 'sun' as const },
      { n: 6, s: 'cloud' as const },
    ],
  },
  {
    name: '스트레이트 플러시',
    text: '같은 색으로 5장 연속',
    cards: [
      { n: 5, s: 'cloud' as const },
      { n: 6, s: 'cloud' as const },
      { n: 7, s: 'cloud' as const },
      { n: 8, s: 'cloud' as const },
      { n: 9, s: 'cloud' as const },
    ],
  },
] as const;

const lexioRulesComboGridClassBase =
  'grid max-w-full [grid-template-columns:max-content_max-content_minmax(0,1fr)] gap-x-3 gap-y-2.5 bg-black/20 px-3 py-3 text-sm leading-relaxed text-purple-100/85 sm:gap-x-4 sm:px-4 sm:py-3.5';

const lexioRulesComboGridClass = `${lexioRulesComboGridClassBase} rounded-xl`;

const lexioRulesComboGridClass5 = `${lexioRulesComboGridClassBase} rounded-l-xl rounded-r-none`;

export type LexioRulesContentProps = {
  mode?: 'offline' | 'online';
  playerCount?: number;
  maxSessionRounds?: number;
};

function gameOverviewNote(
  mode: 'offline' | 'online',
  playerCount?: number,
): React.ReactNode {
  if (playerCount != null && playerCount >= 3) {
    return (
      <>
        이 방·판은 <strong>{lexioRulesLabelForPlayerCount(playerCount)}</strong>{' '}
        설정으로 진행됩니다.
      </>
    );
  }
  if (mode === 'online') {
    return (
      <>
        온라인 방은 <strong>3~5인</strong>에 따라 타일 범위·패 수가 달라집니다.
        대기실·게임 중 상단에서 인원을 확인하세요.
      </>
    );
  }
  return (
    <>
      이 화면의 플레이는 <strong>5인·전체 60장·각 12장</strong> 규칙에 맞춰져
      있습니다.
    </>
  );
}

export default function LexioRulesContent({
  mode = 'offline',
  playerCount,
  maxSessionRounds = 20,
}: LexioRulesContentProps) {
  return (
    <div className="lexio-rules-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-5 text-slate-100 sm:p-6">
      <section
        className="rounded-xl px-5 py-6 sm:px-8 sm:py-8"
        style={{
          background: `
                    linear-gradient(165deg, rgba(255,255,255,0.07) 0%, transparent 42%),
                    repeating-linear-gradient(
                      -12deg,
                      transparent,
                      transparent 3px,
                      rgba(0,0,0,0.028) 3px,
                      rgba(0,0,0,0.028) 6px
                    ),
                    linear-gradient(175deg, #0f766e 0%, #0d9488 48%, #2dd4bf 100%)
                  `,
          boxShadow:
            'inset 0 0 0 1px rgba(0,0,0,0.14), 0 10px 28px rgba(0,0,0,0.28)',
          color: '#0c1a1a',
        }}
      >
        <h3 className="mb-1 text-center text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
          렉시오 인원별 세팅
        </h3>
        <p className="mb-5 text-center text-sm font-medium leading-relaxed text-slate-900/90">
          렉시오는 3인에서 5인까지 즐길 수 있습니다.
          <br />
          인원마다 처음 나눠 갖는 타일의 숫자 범위와 장수가 달라집니다.
        </p>
        <ul className="space-y-3.5 text-sm font-medium leading-relaxed text-slate-900 sm:text-[15px]">
          <li className="flex gap-2.5">
            <span className="shrink-0 select-none pt-0.5" aria-hidden>
              ▶
            </span>
            <span>
              <strong>3인</strong>: 숫자 <strong>1~9</strong>까지의 타일만 쓰며,
              각자 <strong>12장</strong>씩 받습니다.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="shrink-0 select-none pt-0.5" aria-hidden>
              ▶
            </span>
            <span>
              <strong>4인</strong>: 숫자 <strong>1~13</strong>까지 사용하며,
              각자 <strong>13장</strong>씩 받습니다.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="shrink-0 select-none pt-0.5" aria-hidden>
              ▶
            </span>
            <span>
              <strong>5인</strong>: 세트의 <strong>전체 타일</strong>을 모두
              사용하며, 각자 <strong>12장</strong>씩 받습니다.
            </span>
          </li>
        </ul>
        <p className="mt-5 text-center text-xs font-semibold tracking-wide text-slate-900/75">
          * 보드게임 인원별 구성 기준 *
        </p>
      </section>

      <section className="lexio-rule-section">
        <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-purple-300/80">
          게임 개요
        </h3>
        <p className="text-sm leading-relaxed text-purple-100/85">
          <span className="underline decoration-purple-200/75 underline-offset-[3px]">
            손에 든 타일을 가장 먼저 모두 내려놓는 사람이 승리합니다.
          </span>{' '}
          돌아가며 한 명씩 같은 종류의 더 강한 조합을 내거나 패스합니다.{' '}
          {gameOverviewNote(mode, playerCount)}
        </p>
      </section>

      <section className="lexio-rule-section">
        <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-purple-300/80">
          타일 구성
        </h3>
        <div className="space-y-5 text-sm leading-relaxed text-purple-100/85">
          <p>5인 기준 총 60장: 1~15 숫자 × 4색(초/파/노/빨)</p>

          <div>
            <p className="mb-2">
              <strong>숫자 강도</strong>(약 → 강): 3 &lt; 4 &lt; … &lt; 15 &lt; 1
              &lt; 2 — 같은 색끼리만 보면 아래 순서입니다.
            </p>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-black/25 px-3 py-3 sm:px-4">
              <span className="pointer-events-none inline-flex shrink-0">
                <LexioPlayCard number={3} suit="cloud" small rulesTight />
              </span>
              <span className="px-0.5 text-xs text-purple-200/60">&lt;</span>
              <span className="text-[11px] text-purple-200/55 sm:text-xs">
                4 ~ 14
              </span>
              <span className="px-0.5 text-xs text-purple-200/60">&lt;</span>
              <span className="pointer-events-none inline-flex shrink-0">
                <LexioPlayCard number={15} suit="cloud" small rulesTight />
              </span>
              <span className="px-0.5 text-xs text-purple-200/60">&lt;</span>
              <span className="pointer-events-none inline-flex shrink-0">
                <LexioPlayCard number={1} suit="cloud" small rulesTight />
              </span>
              <span className="px-0.5 text-xs text-purple-200/60">&lt;</span>
              <span className="pointer-events-none inline-flex shrink-0">
                <LexioPlayCard number={2} suit="cloud" small rulesTight />
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2">
              <strong>색상 강도</strong>(약 → 강):{' '}
              <span style={{ color: COLOR_HEX.blue }}>파</span> &lt;{' '}
              <span style={{ color: COLOR_HEX.yellow }}>노</span> &lt;{' '}
              <span style={{ color: COLOR_HEX.green }}>초</span> &lt;{' '}
              <span style={{ color: COLOR_HEX.red }}>빨</span> — 숫자가 같을 때
              문양(색)으로 가립니다.
            </p>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-xl bg-black/25 px-3 py-3 sm:px-4">
              {(
                [
                  ['cloud', '파'],
                  ['star', '노'],
                  ['moon', '초'],
                  ['sun', '빨'],
                ] as const
              ).map(([suit, label], i, arr) => (
                <React.Fragment key={suit}>
                  <span className="pointer-events-none inline-flex shrink-0 flex-col items-center gap-0.5">
                    <LexioPlayCard number={10} suit={suit} small rulesTight />
                    <span className="text-[10px] text-purple-200/70">
                      {label}
                    </span>
                  </span>
                  {i < arr.length - 1 && (
                    <span className="self-start pt-3 text-xs text-purple-200/60">
                      &lt;
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2">
              가장 약한 타일은 <strong>{LOWEST_TILE_LABEL}</strong>, 가장 강한
              타일은 <strong>빨 2</strong>입니다.
            </p>
            <div className="flex flex-wrap items-center gap-4 rounded-xl bg-black/25 px-3 py-3 sm:gap-6 sm:px-4">
              <div className="pointer-events-none flex flex-col items-center gap-1.5">
                <LexioPlayCard number={3} suit="cloud" small rulesTight />
                <span className="text-[11px] font-medium text-purple-200/80">
                  {LOWEST_TILE_LABEL}
                </span>
              </div>
              <span
                className="hidden text-purple-200/40 sm:inline"
                aria-hidden
              >
                ···
              </span>
              <div className="pointer-events-none flex flex-col items-center gap-1.5">
                <LexioPlayCard number={2} suit="sun" small rulesTight />
                <span className="text-[11px] font-medium text-purple-200/80">
                  빨 2
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lexio-rule-section">
        <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-purple-300/80">
          진행 방식
        </h3>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-purple-100/85">
          <li>
            <strong>{LOWEST_TILE_LABEL}</strong>을 손에 든 사람이 첫 라운드를
            시작합니다.
          </li>
          <li>이후 같은 장수의 더 강한 조합을 내거나 패스합니다.</li>
          <li>1, 2, 3장 조합은 같은 종류끼리만 비교합니다.</li>
          <li>5장 조합은 종류가 달라도 강도에 따라 이길 수 있습니다.</li>
          <li>
            나머지 모두가 패스하면 마지막에 낸 사람이 새 트릭을 리드합니다.
          </li>
          <li>가장 먼저 손에 든 타일을 모두 내려놓으면 승리!</li>
        </ul>
      </section>

      <section className="lexio-rule-section">
        <h3 className="mb-3 text-xs uppercase tracking-[0.3em] text-purple-300/80">
          조합 종류
        </h3>

        <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-200/90">
          1~3장 조합
        </h4>
        <div className={lexioRulesComboGridClass}>
          {LEXIO_RULES_COMBOS_1_3.map((row) => (
            <div key={row.name} className="contents">
              <strong className="flex items-center self-stretch text-sm text-purple-100 sm:text-[15px]">
                {row.name}
              </strong>
              <div className="flex min-h-0 min-w-0 flex-nowrap items-center justify-start gap-1 self-stretch overflow-x-auto">
                {row.cards.map((c, i) => (
                  <span
                    key={`${row.name}-${i}`}
                    className="pointer-events-none inline-flex shrink-0"
                  >
                    <LexioPlayCard number={c.n} suit={c.s} small rulesTight />
                  </span>
                ))}
              </div>
              <p className="flex min-h-0 min-w-0 flex-col justify-center self-stretch text-xs leading-snug text-purple-100/70 sm:text-sm sm:leading-relaxed">
                {row.text}
              </p>
            </div>
          ))}
        </div>

        <h4 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-purple-200/90">
          5장 조합
        </h4>
        <div className="flex min-w-0 flex-row items-stretch gap-0">
          <div className={`${lexioRulesComboGridClass5} min-w-0 flex-1`}>
            {LEXIO_RULES_COMBOS_5.map((row) => (
              <div key={row.name} className="contents">
                <strong className="flex items-center self-stretch text-sm text-purple-100 sm:text-[15px]">
                  {row.name}
                </strong>
                <div className="flex min-h-0 min-w-0 flex-nowrap items-center justify-start gap-1 self-stretch overflow-x-auto">
                  {row.cards.map((c, i) => (
                    <span
                      key={`${row.name}-${i}`}
                      className="pointer-events-none inline-flex shrink-0"
                    >
                      <LexioPlayCard number={c.n} suit={c.s} small rulesTight />
                    </span>
                  ))}
                </div>
                <p className="flex min-h-0 min-w-0 flex-col justify-center self-stretch text-xs leading-snug text-purple-100/70 sm:text-sm sm:leading-relaxed">
                  {row.text}
                </p>
              </div>
            ))}
          </div>
          <aside
            className="flex w-8 shrink-0 flex-col items-center justify-between rounded-lg border border-amber-400/25 bg-amber-950/25 px-0 py-2 text-center sm:py-3"
            aria-label="5장 족보 강도: 위에서 아래로 강해짐"
          >
            <span className="text-[9px] font-semibold leading-tight text-amber-200/95 sm:text-[10px]">
              낮은
              <br />
              족보
            </span>
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-evenly gap-0.5 py-1"
              aria-hidden
            >
              {[0, 1, 2, 3].map((i) => (
                <ChevronDown
                  key={i}
                  className="h-3.5 w-3.5 shrink-0 text-amber-300/85 sm:h-4 sm:w-4"
                  strokeWidth={2.75}
                />
              ))}
            </div>
            <span className="text-[9px] font-semibold leading-tight text-amber-200/95 sm:text-[10px]">
              높은
              <br />
              족보
            </span>
          </aside>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-purple-100/70">
          5장 조합은 위에서 아래로 강해지며, 스트레이트 &lt; 플러시 &lt; 풀하우스
          &lt; 포카드 &lt; 스트레이트 플러시 순입니다.
        </p>
      </section>

      <section className="lexio-rule-section">
        <h3 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-purple-300/80">
          <Crown
            className="h-4 w-4 shrink-0 text-amber-300/90"
            aria-hidden
          />
          최종 승리 조건
        </h3>
        <ul className="list-inside list-disc space-y-1.5 text-sm text-purple-100/85">
          <li>
            시작할 때 총 라운드 수를 정합니다.(최대 {maxSessionRounds}판)
          </li>
          <li>
            한 판이 끝날 때마다, 각자 손에 남은 타일 수만큼 코인을 얻습니다.
          </li>
          <li>
            이때 손에 <strong>2</strong> 숫자 타일이 n장만큼 있으면 그 사람의
            코인이 2의 n승배만큼 코인을 먹습니다.
          </li>
        </ul>
      </section>
    </div>
  );
}
