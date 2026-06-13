/**
 * 방명록 / 버그신고 API 클라이언트.
 */

export type FeedbackKind = 'guestbook' | 'bug';

export type FeedbackEntry = {
  id: string;
  name: string;
  message: string;
  at: number;
};

export const FEEDBACK_NAME_MAX = 24;
export const FEEDBACK_MESSAGE_MAX = 500;

export type ListFeedbackResult =
  | { status: 'ok'; entries: FeedbackEntry[] }
  | { status: 'disabled' }
  | { status: 'error' };

export type SubmitFeedbackResult =
  | { status: 'ok'; entry: FeedbackEntry }
  | { status: 'disabled' }
  | { status: 'invalid' }
  | { status: 'error' };

export async function listFeedback(
  kind: FeedbackKind,
): Promise<ListFeedbackResult> {
  try {
    const res = await fetch(`/api/feedback?type=${kind}`, {
      headers: { Accept: 'application/json' },
    });
    if (res.status === 503) return { status: 'disabled' };
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as { entries?: FeedbackEntry[] };
    return {
      status: 'ok',
      entries: Array.isArray(data.entries) ? data.entries : [],
    };
  } catch {
    return { status: 'error' };
  }
}

export async function submitFeedback(
  kind: FeedbackKind,
  payload: { name: string; message: string },
): Promise<SubmitFeedbackResult> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: kind, ...payload }),
    });
    if (res.status === 503) return { status: 'disabled' };
    if (res.status === 400) return { status: 'invalid' };
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as { entry?: FeedbackEntry };
    if (!data.entry) return { status: 'error' };
    return { status: 'ok', entry: data.entry };
  } catch {
    return { status: 'error' };
  }
}
