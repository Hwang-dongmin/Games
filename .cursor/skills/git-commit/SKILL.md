---
name: git-commit
description: >-
  Create git commits when the user asks (커밋해줘, 커밋 해줘, commit, git commit,
  commit this). English subject; Korean body as short bullet list (plain tone).
---

# Git commit (English subject, Korean bullet body)

Apply when the user requests a commit (including **커밋해줘**).

## Requirements

- **Subject line (first line): English only** — `feat(scope): short summary`
- **Body: Korean bullet list** — `-` items only; **no** `습니다` / formal endings; **no blank lines** between bullets (one `-m` for the whole body, not one per line)
- **Tone:** 아주 짧고 쉬운 말 (명사·동사 원형, “~함”, “~추가”, “~수정” 정도)
- **Reply after commit:** same style — bullet list in Korean (body와 비슷하게)
- Commit only when asked; never push unless asked
- Never update `git config`, skip hooks, force push, hard reset, or commit secrets
- Avoid `git commit --amend` unless the user requests it and amend preconditions are met

## Commit message format

```
feat(scope): short English subject

- 바뀐 것 한 줄
- 또 다른 변경
- 영향·참고 (필요할 때만)
```

**Good**

```
feat(lexio-offline): redesign setup lobby

- 설정 화면 카드 하나로 통합
- AI 2~4명 슬라이더
- 인원별 덱/손패 딜링
```

**Avoid**

```
- …통합했습니다.
- …적용하였습니다.
```

## Workflow

1. Parallel: `git status`, `git diff`, `git log`
2. Stage files; English subject + Korean bullet body (one body block, no blank lines between `-` items; on Windows use `-F` UTF-8 file if Korean breaks)
3. Commit; `git status`
4. Reply: Korean bullet summary (간단 말투)
5. Hook failed → fix, **new** commit (no amend unless allowed)
