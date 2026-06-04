---
name: git-commit
description: >-
  Create git commits when the user asks (커밋해줘, 커밋 해줘, commit, git commit,
  commit this). English subject; Korean body as short bullet list (plain tone).
  Stage only files changed in the current agent session.
---

# Git commit (English subject, Korean bullet body)

Apply when the user requests a commit (including **커밋해줘**).

## Requirements

- **Keep it minimal** — subject and body as short as possible; no extra explanation, no “why” paragraphs; **omit body** if the subject is enough
- **Subject line (first line): English only** — `feat(scope): short summary` (roughly ≤50 chars when possible)
- **Body: Korean bullet list** — `-` items only; **no** `습니다` / formal endings; **no blank lines** between bullets; **보통 0–2줄**, 많아도 3줄; **핵심만** (see format section)
- **Tone:** 아주 짧고 쉬운 말 (명사·동사 원형, “~함”, “~추가”, “~수정” 정도)
- **Reply after commit:** same style — bullet list in Korean (body와 비슷하게)
- Commit only when asked; never push unless asked
- Never update `git config`, skip hooks, force push, hard reset, or commit secrets
- Avoid `git commit --amend` unless the user requests it and amend preconditions are met
- **Scope: current agent session only** — see below

## Current-agent scope (mandatory)

커밋에는 **이 대화(현재 에이전트 세션)에서 직접 수정·생성·삭제한 파일만** 포함한다. 다른 에이전트/다른 채팅에서 바뀐 파일은 넣지 않는다.

### Session file list

Before staging, build the list of paths this session owns:

1. **Conversation** — every path touched by Write / StrReplace / Delete / EditNotebook (and explicit shell commands you ran that created or changed files) in **this** chat.
2. **User scope** — if the user names specific files or a feature area, intersect with that list; do not expand beyond what they asked unless they say “전부”.
3. **Do not infer** — `git status` alone is not enough; unrelated dirty files stay unstaged.

### Staging rules

- Use **`git add <path>`** per file (or a small explicit set). **Never** `git add .`, `git add -A`, or `git add -u` unless **every** dirty path in status is on the session file list.
- Compare `git status` / `git diff --name-only` to the session list; **skip** anything not on the list.
- If a session file has edits you did not make (e.g. mixed with another agent), stage only with **`git add -p`** on hunks from this session, or ask the user — do not commit other agents’ hunks.
- If the session list is empty but the tree is dirty, tell the user which paths are dirty and ask what to include; do not commit everything by default.

### After commit

- Leftover unstaged changes from other sessions are expected; mention them briefly in the reply if they remain.

## Commit message format

**맨 위 1줄 = 제목(English)** · 빈 줄 뒤 **본문(Korean `-`, 선택)**

| 구분 | 내용 |
|------|------|
| **제목** | scope + 핵심 한 줄 (대부분 여기만으로 충분) |
| **본문** | **어느 화면/기능** + **뭐가 바뀌었는지** — 쉬운 말, **1~2불릿** |

- 한 불릿에 **같은 맥락** 묶기 (파일·옵션 나열 X)
- **화면·기능 이름** 정도만 (예: 오프라인 대기, 설정 모달, 1위 폭죽)
- 금지: `설명 가독성`, `UI 개선` / 파일 경로·클래스 나열·색상 코드

**Good (적당)**

```
feat(lexio-offline): center setup hero title

- 오프라인 대기: 제목 가운데, 환영 문구 추가
```

```
feat(lexio): integrate audio and settings

- 대기·로비부터 배경음, 설정에 소리 조절
```

**Too vague**

```
- 제목 가운데·환영 문구
- 설명 가독성
```

**Too detailed**

```
- lexioSounds.ts: 타일·승리·뿌리기 효과음
- lexioBgm.ts: 아르페지오 배경음
- localStorage 볼륨·뮤트
```

## Workflow

1. Parallel: `git status`, `git diff`, `git log`
2. **Build session file list** (conversation + user scope); subtract anything that must not ship
3. **Stage only** listed paths (`git add <path>`); never blanket-add the repo
4. English subject + Korean bullet body (one body block, no blank lines between `-` items; on Windows use `-F` UTF-8 file if Korean breaks)
5. Commit; `git status`
6. Reply: Korean bullets (짧게, 핵심만); note unstaged files from other sessions if any
7. Hook failed → fix, **new** commit (no amend unless allowed)
