import { useEffect } from 'react';
import { BookOpen, X } from 'lucide-react';
import LexioRulesContent, {
  type LexioRulesContentProps,
} from './LexioRulesContent';

type LexioRulesModalProps = LexioRulesContentProps & {
  open: boolean;
  onClose: () => void;
};

export default function LexioRulesModal({
  open,
  onClose,
  ...contentProps
}: LexioRulesModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="lexio-menu-overlay absolute inset-0 bg-black/75 backdrop-blur-md"
        aria-label="규칙 닫기"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lexio-rules-modal-title"
        className="lexio-rules-panel lexio-menu-dialog relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, #1e1b4b 0%, #0a0a23 100%)',
          boxShadow:
            '0 0 0 1px rgba(168,85,247,0.4), 0 30px 60px -20px rgba(0,0,0,0.8)',
        }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 p-5 backdrop-blur-md sm:p-6"
          style={{
            background:
              'linear-gradient(180deg, rgba(30,27,75,0.95) 0%, rgba(30,27,75,0.85) 100%)',
            borderBottom: '1px solid rgba(168,85,247,0.3)',
          }}
        >
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.4em] text-purple-300/80">
              Guide
            </p>
            <h2
              id="lexio-rules-modal-title"
              className="flex items-center gap-2.5 font-serif text-lg tracking-wide text-purple-100 sm:text-2xl"
            >
              <BookOpen className="h-5 w-5 shrink-0 text-purple-300/80" />
              렉시오 게임 규칙
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-slate-300/70 transition-colors hover:bg-white/[0.05] hover:text-purple-200"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <LexioRulesContent {...contentProps} />
      </div>
    </div>
  );
}
