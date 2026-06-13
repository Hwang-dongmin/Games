import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bug, Home, MessageSquareHeart, Send } from 'lucide-react';
import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_NAME_MAX,
  listFeedback,
  submitFeedback,
  type FeedbackEntry,
  type FeedbackKind,
  type ListFeedbackResult,
} from '../utils/feedbackApi';

type TabConfig = {
  kind: FeedbackKind;
  label: string;
  icon: typeof MessageSquareHeart;
  placeholder: string;
  emptyText: string;
  submitText: string;
  accent: string;
};

const TABS: TabConfig[] = [
  {
    kind: 'guestbook',
    label: '방명록',
    icon: MessageSquareHeart,
    placeholder: '자유롭게 한마디 남겨주세요.',
    emptyText: '아직 글이 없어요. 첫 방명록을 남겨보세요!',
    submitText: '방명록 남기기',
    accent: 'violet',
  },
  {
    kind: 'bug',
    label: '버그신고',
    icon: Bug,
    placeholder: '어떤 상황에서 어떤 문제가 있었는지 적어주세요.',
    emptyText: '접수된 버그신고가 없습니다.',
    submitText: '버그 제보하기',
    accent: 'rose',
  },
];

function formatTime(at: number): string {
  if (!at) return '';
  const d = new Date(at);
  const now = Date.now();
  const diff = Math.floor((now - at) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

export default function Feedback() {
  const [activeKind, setActiveKind] = useState<FeedbackKind>('guestbook');
  const tab = TABS.find((t) => t.kind === activeKind) ?? TABS[0];

  const [results, setResults] = useState<
    Partial<Record<FeedbackKind, ListFeedbackResult>>
  >({});
  const requestedRef = useRef<Set<FeedbackKind>>(new Set());

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedNotice, setSubmittedNotice] = useState('');

  // 각 탭은 처음 열릴 때 한 번만 조회한다. (자동/주기 새로고침 없음)
  useEffect(() => {
    setFormError('');
    setSubmittedNotice('');
    if (requestedRef.current.has(activeKind)) return;
    requestedRef.current.add(activeKind);
    let cancelled = false;
    void listFeedback(activeKind).then((next) => {
      if (!cancelled) {
        setResults((prev) => ({ ...prev, [activeKind]: next }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeKind]);

  const result: ListFeedbackResult = results[activeKind] ?? {
    status: 'ok',
    entries: [],
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length === 0) {
      setFormError('내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    setSubmittedNotice('');

    const res = await submitFeedback(activeKind, {
      name: name.trim(),
      message: trimmed,
    });
    setSubmitting(false);

    if (res.status === 'ok') {
      setMessage('');
      setSubmittedNotice(
        activeKind === 'bug'
          ? '제보가 접수되었습니다. 감사합니다!'
          : '소중한 한마디 감사합니다!',
      );
      setResults((prev) => {
        const current = prev[activeKind];
        const entries =
          current && current.status === 'ok' ? current.entries : [];
        return {
          ...prev,
          [activeKind]: { status: 'ok', entries: [res.entry, ...entries] },
        };
      });
      return;
    }
    if (res.status === 'disabled') {
      setFormError('서버가 연결되지 않았습니다. (Upstash Redis 설정 확인)');
      return;
    }
    if (res.status === 'invalid') {
      setFormError('입력값을 확인해 주세요.');
      return;
    }
    setFormError('전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  };

  const entries: FeedbackEntry[] =
    result.status === 'ok' ? result.entries : [];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08070e] text-zinc-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-32 -left-24 h-72 w-72 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-fuchsia-600/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/[0.07] bg-[#08070e]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            방명록 &amp; 버그신고
          </h1>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-2 text-sm text-zinc-300 transition hover:bg-white/5"
          >
            <Home className="h-4 w-4" />
            홈으로
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 sm:py-10">
        <div className="mb-6 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.kind === activeKind;
            return (
              <button
                key={t.kind}
                type="button"
                onClick={() => setActiveKind(t.kind)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-violet-600 text-white shadow-[0_0_20px_-6px_rgba(139,92,246,0.6)]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
        >
          <div className="mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={FEEDBACK_NAME_MAX}
              placeholder="닉네임 (선택)"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50"
            />
          </div>
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={FEEDBACK_MESSAGE_MAX}
              rows={4}
              placeholder={tab.placeholder}
              className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-zinc-600">
              {message.length}/{FEEDBACK_MESSAGE_MAX}
            </span>
          </div>

          {formError && (
            <p className="mt-3 text-sm text-rose-300">{formError}</p>
          )}
          {submittedNotice && (
            <p className="mt-3 text-sm text-emerald-300">{submittedNotice}</p>
          )}

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {submitting ? '전송 중…' : tab.submitText}
            </button>
          </div>
        </form>

        <div className="mb-3">
          <h2 className="text-sm font-medium text-zinc-400">
            {tab.label} {entries.length > 0 && `· ${entries.length}`}
          </h2>
        </div>

        {result.status === 'disabled' && (
          <p className="py-12 text-center text-sm text-zinc-500">
            서버가 연결되지 않았습니다. (Upstash Redis 설정 확인)
          </p>
        )}

        {result.status === 'error' && (
          <p className="py-12 text-center text-sm text-zinc-500">
            목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </p>
        )}

        {result.status === 'ok' && entries.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-500">
            {tab.emptyText}
          </p>
        )}

        {result.status === 'ok' && entries.length > 0 && (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li
                key={entry.id || `${entry.name}-${entry.at}`}
                className="rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-zinc-200">
                    {entry.name}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {formatTime(entry.at)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">
                  {entry.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
