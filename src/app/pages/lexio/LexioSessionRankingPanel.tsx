import React, {
  useMemo,
  useState,
  useRef,
  useLayoutEffect,
  useCallback,
} from 'react';
import { motion } from 'motion/react';
import { ChevronDown, ChevronUp, Crown } from 'lucide-react';
import type { LexioPlayerFinishCoins } from './LexioFirstPersonScene';
import LexioVictoryFireworks from './LexioVictoryFireworks';

export type LexioSessionRankEntry = {
  rank: number;
  playerId: number;
  name: string;
  sessionTotal: number;
};

export function buildLexioSessionRankings(
  playersCoins: LexioPlayerFinishCoins[],
): LexioSessionRankEntry[] {
  const sorted = [...playersCoins].sort(
    (a, b) => a.sessionTotal - b.sessionTotal,
  );
  const result: LexioSessionRankEntry[] = [];
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].sessionTotal > sorted[i - 1].sessionTotal) {
      rank = i + 1;
    }
    result.push({
      rank,
      playerId: sorted[i].playerId,
      name: sorted[i].name,
      sessionTotal: sorted[i].sessionTotal,
    });
  }
  return result;
}

const RANK_LABEL: Record<number, string> = {
  1: '1',
  2: '2',
  3: '3',
};

const EASE = [0.33, 1, 0.28, 1] as [number, number, number, number];
const DURATION = 0.44;

type LexioSessionRankingPanelProps = {
  playersCoins: LexioPlayerFinishCoins[];
  humanPlayerId?: number;
};

export default function LexioSessionRankingPanel({
  playersCoins,
  humanPlayerId,
}: LexioSessionRankingPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  const listInnerRef = useRef<HTMLDivElement>(null);

  const rankings = useMemo(
    () => buildLexioSessionRankings(playersCoins),
    [playersCoins],
  );

  const measureListHeight = useCallback(() => {
    if (listInnerRef.current) {
      setListHeight(listInnerRef.current.offsetHeight);
    }
  }, []);

  useLayoutEffect(() => {
    if (!collapsed) {
      measureListHeight();
    }
  }, [collapsed, rankings, measureListHeight]);

  useLayoutEffect(() => {
    if (collapsed) return;
    window.addEventListener('resize', measureListHeight);
    return () => window.removeEventListener('resize', measureListHeight);
  }, [collapsed, measureListHeight]);

  const topRank = rankings[0]?.rank ?? 1;
  const winners = rankings.filter((r) => r.rank === topRank);
  const winnerLabel =
    winners.length === 1
      ? `${winners[0].name} 승리!`
      : `${winners.map((w) => w.name).join(', ')} 공동 1위!`;

  const humanIsFirst =
    humanPlayerId !== undefined &&
    rankings.some((r) => r.playerId === humanPlayerId && r.rank === topRank);

  const liftY = collapsed && listHeight > 0 ? -listHeight / 2 : 0;

  return (
    <div aria-live="polite" aria-label="게임 순위">
      <motion.div
        className="lexio-ranking-overlay pointer-events-none fixed inset-0 z-[15]"
        initial={false}
        animate={{ opacity: collapsed ? 0 : 1 }}
        transition={{ duration: DURATION, ease: EASE }}
        aria-hidden
      />

      <LexioVictoryFireworks active={humanIsFirst} />

      <div className="pointer-events-none fixed inset-0 z-[16] flex items-center justify-center px-4">
        <motion.div
          className="pointer-events-auto w-full max-w-md"
          initial={false}
          animate={{ y: liftY }}
          transition={{ duration: DURATION, ease: EASE }}
        >
          <div
            className={`lexio-ranking-card ${
              collapsed ? 'lexio-ranking-card--collapsed rounded-2xl' : 'rounded-2xl'
            }`}
          >
            <span className="lexio-ranking-card-ring" aria-hidden />
            <span className="lexio-ranking-card-glow" aria-hidden />

            <div
              role={collapsed ? 'button' : undefined}
              tabIndex={collapsed ? 0 : undefined}
              onClick={collapsed ? () => setCollapsed(false) : undefined}
              onKeyDown={
                collapsed
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCollapsed(false);
                      }
                    }
                  : undefined
              }
              className={`lexio-ranking-header ${
                collapsed ? 'cursor-pointer rounded-2xl' : 'rounded-t-2xl'
              } ${collapsed ? '' : 'border-b border-purple-400/15'}`}
              aria-expanded={!collapsed}
              aria-label={collapsed ? '순위 펼치기' : undefined}
            >
              <div className="lexio-ranking-header-action">
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCollapsed(true);
                  }}
                  initial={false}
                  animate={{ opacity: collapsed ? 0 : 1 }}
                  transition={{ duration: DURATION * 0.7, ease: EASE }}
                  className="lexio-ranking-collapse-btn"
                  style={{ pointerEvents: collapsed ? 'none' : 'auto' }}
                  aria-label="순위 접기"
                >
                  <ChevronUp className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
                </motion.button>

                <motion.span
                  initial={false}
                  animate={{ opacity: collapsed ? 1 : 0 }}
                  transition={{ duration: DURATION * 0.7, ease: EASE }}
                  className="lexio-ranking-expand-icon"
                  aria-hidden={!collapsed}
                >
                  <ChevronDown className="h-4 w-4" />
                </motion.span>
              </div>

              <div className="lexio-ranking-winner-block">
                <div className="lexio-ranking-crown-wrap">
                  <Crown
                    className="h-5 w-5 text-amber-300 sm:h-6 sm:w-6"
                    strokeWidth={2.25}
                    aria-hidden
                  />
                </div>
                <div className="lexio-ranking-winner-lines">
                  <span className="lexio-ranking-winner-line" aria-hidden />
                  <h2 className="lexio-ranking-winner-title truncate">
                    {winnerLabel}
                  </h2>
                  <span className="lexio-ranking-winner-line" aria-hidden />
                </div>
              </div>
            </div>

            <motion.div
              initial={false}
              animate={{
                height: collapsed ? 0 : listHeight || 'auto',
                opacity: collapsed ? 0 : 1,
              }}
              transition={{
                height: { duration: DURATION, ease: EASE },
                opacity: { duration: DURATION * 0.75, ease: EASE },
              }}
              className="lexio-ranking-list-wrap overflow-hidden"
              style={{ pointerEvents: collapsed ? 'none' : 'auto' }}
            >
              <div ref={listInnerRef} className="rounded-b-2xl">
                <ol className="lexio-ranking-list">
                  {rankings.map((entry) => {
                    const isHuman = entry.playerId === humanPlayerId;
                    const isTop = entry.rank === topRank;
                    const badgeClass =
                      entry.rank <= 3
                        ? `lexio-ranking-badge--${entry.rank}`
                        : '';
                    return (
                      <li
                        key={entry.playerId}
                        className={`lexio-ranking-row ${
                          isTop ? 'lexio-ranking-row--top' : ''
                        } ${isHuman ? 'lexio-ranking-row--human' : ''}`}
                      >
                        <span
                          className={`lexio-ranking-badge ${badgeClass}`.trim()}
                        >
                          {entry.rank === 1 ? (
                            <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
                          ) : (
                            RANK_LABEL[entry.rank] ?? entry.rank
                          )}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate text-sm font-medium sm:text-base ${
                            isHuman ? 'text-purple-50' : 'text-purple-100/92'
                          }`}
                        >
                          {entry.name}
                          {isHuman && (
                            <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/75">
                              (나)
                            </span>
                          )}
                        </span>
                        <span className="lexio-ranking-coins">
                          🪙 {entry.sessionTotal}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
