import { BookOpen, Bot, Layers3, Sparkles } from 'lucide-react';
import {
  lexioDeckTileCount,
  lexioHandSizeForPlayerCount,
  LEXIO_AI_DIFFICULTY_OPTIONS,
  type LexioAIDifficulty,
} from '../../utils/lexio';

type LexioOfflineSetupProps = {
  pendingSessionRounds: number;
  maxSessionRounds: number;
  onSessionRoundsChange: (rounds: number) => void;
  pendingAiCount: number;
  minAiCount: number;
  maxAiCount: number;
  onAiCountChange: (count: number) => void;
  pendingAiDifficulty: LexioAIDifficulty;
  onAiDifficultyChange: (difficulty: LexioAIDifficulty) => void;
  onStart: () => void;
  onOpenRules: () => void;
};

export default function LexioOfflineSetup({
  pendingSessionRounds,
  maxSessionRounds,
  onSessionRoundsChange,
  pendingAiCount,
  minAiCount,
  maxAiCount,
  onAiCountChange,
  pendingAiDifficulty,
  onAiDifficultyChange,
  onStart,
  onOpenRules,
}: LexioOfflineSetupProps) {
  const playerCount = pendingAiCount + 1;
  const handSize = lexioHandSizeForPlayerCount(playerCount);
  const deckTiles = lexioDeckTileCount(playerCount);
  const selectedDifficulty = LEXIO_AI_DIFFICULTY_OPTIONS.find(
    (o) => o.id === pendingAiDifficulty,
  );

  return (
    <div className="lexio-offline-setup">
      <div className="lexio-offline-setup-ambient" aria-hidden>
        <span className="lexio-offline-setup-orb lexio-offline-setup-orb-a" />
        <span className="lexio-offline-setup-orb lexio-offline-setup-orb-b" />
      </div>

      <article className="lexio-offline-setup-shell">
        <header className="lexio-offline-setup-hero">
          <div className="lexio-offline-setup-hero-row">
            <h2 className="lexio-offline-setup-title">Welcome to Lexio</h2>
            <button
              type="button"
              onClick={onOpenRules}
              className="lexio-offline-setup-rules-btn"
            >
              <BookOpen className="lexio-offline-setup-rules-icon" aria-hidden />
              게임 규칙
            </button>
          </div>
          <p className="lexio-offline-setup-lead">
            한국식 셰딩 게임 렉시오를 AI와 함께 플레이합니다. 보유 패를 모두
            내려놓으면 승리합니다.
          </p>
        </header>

        <div className="lexio-offline-setup-body">
          <ul
            className="lexio-offline-setup-stats"
            aria-label="게임 요약"
          >
            <li className="lexio-offline-setup-stat">
              <Bot className="lexio-offline-setup-stat-icon" aria-hidden />
              <div className="lexio-offline-setup-stat-copy">
                <span className="lexio-offline-setup-stat-label">인원</span>
                <span className="lexio-offline-setup-stat-value">
                  {playerCount}인 · 나 + AI {pendingAiCount}
                </span>
              </div>
            </li>
            <li className="lexio-offline-setup-stat">
              <Layers3 className="lexio-offline-setup-stat-icon" aria-hidden />
              <div className="lexio-offline-setup-stat-copy">
                <span className="lexio-offline-setup-stat-label">패 구성</span>
                <span className="lexio-offline-setup-stat-value">
                  각 {handSize}장 · 덱 {deckTiles}장
                </span>
              </div>
            </li>
            <li className="lexio-offline-setup-stat">
              <Sparkles className="lexio-offline-setup-stat-icon" aria-hidden />
              <div className="lexio-offline-setup-stat-copy">
                <span className="lexio-offline-setup-stat-label">AI 난이도</span>
                <span className="lexio-offline-setup-stat-value">
                  {selectedDifficulty?.label ?? pendingAiDifficulty}
                </span>
              </div>
            </li>
          </ul>

          <div className="lexio-offline-setup-controls">
            <div className="lexio-offline-setup-settings">
              <div className="lexio-offline-setup-rounds">
                <div className="lexio-offline-setup-rounds-head">
                  <label htmlFor="lexio-ai-count">AI 수</label>
                  <span className="lexio-offline-setup-rounds-value">
                    {pendingAiCount}
                    <span className="lexio-offline-setup-rounds-max">
                      / {maxAiCount}
                    </span>
                  </span>
                </div>
                <input
                  id="lexio-ai-count"
                  type="range"
                  min={minAiCount}
                  max={maxAiCount}
                  value={pendingAiCount}
                  onChange={(e) => onAiCountChange(Number(e.target.value))}
                  className="lexio-offline-setup-slider"
                />
                <p className="lexio-offline-setup-rounds-hint">
                  AI {minAiCount}~{maxAiCount}명 (총 {minAiCount + 1}~
                  {maxAiCount + 1}인)
                </p>
              </div>

              <div className="lexio-offline-setup-rounds">
                <div className="lexio-offline-setup-rounds-head">
                  <span id="lexio-ai-difficulty-label">AI 난이도</span>
                </div>
                <div
                  className="lexio-offline-setup-difficulty"
                  role="radiogroup"
                  aria-labelledby="lexio-ai-difficulty-label"
                >
                  {LEXIO_AI_DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={pendingAiDifficulty === option.id}
                      disabled={!option.available}
                      onClick={() => onAiDifficultyChange(option.id)}
                      className={`lexio-offline-setup-difficulty-btn${
                        pendingAiDifficulty === option.id
                          ? ' lexio-offline-setup-difficulty-btn--active'
                          : ''
                      }${!option.available ? ' lexio-offline-setup-difficulty-btn--disabled' : ''}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {selectedDifficulty && (
                  <p className="lexio-offline-setup-rounds-hint">
                    {selectedDifficulty.description}
                  </p>
                )}
              </div>

              <div className="lexio-offline-setup-rounds">
                <div className="lexio-offline-setup-rounds-head">
                  <label htmlFor="lexio-session-rounds">총 라운드(판) 수</label>
                  <span className="lexio-offline-setup-rounds-value">
                    {pendingSessionRounds}
                    <span className="lexio-offline-setup-rounds-max">
                      / {maxSessionRounds}
                    </span>
                  </span>
                </div>
                <input
                  id="lexio-session-rounds"
                  type="range"
                  min={1}
                  max={maxSessionRounds}
                  value={pendingSessionRounds}
                  onChange={(e) =>
                    onSessionRoundsChange(Number(e.target.value))
                  }
                  className="lexio-offline-setup-slider"
                />
                <p className="lexio-offline-setup-rounds-hint">
                  판 종료 시 남은 패 수만큼 코인 획득 · 손에 2가 있으면 해당 판
                  코인 2배
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onStart}
              className="lexio-offline-setup-cta"
            >
              게임 시작
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
