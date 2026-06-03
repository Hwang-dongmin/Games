---
name: git-commit
description: >-
  Create git commits when the user asks (커밋해줘, 커밋 해줘, commit, git commit,
  commit this). Commit message in English; post-commit summary in Korean.
---

# Git commit (English message, Korean summary)

Apply when the user requests a commit (including **커밋해줘**).

## Requirements

- **English commit messages** only (1–2 sentences; match recent `git log` style).
- After committing, provide a **detailed summary in Korean (한국어)** explaining what changed and why.
- Commit **only when explicitly asked**; never push unless asked.
- **Never** update `git config`, skip hooks, force push, hard reset, or commit secrets.
- Avoid `git commit --amend` unless the user requests it and amend preconditions are met.

## Workflow

1. Parallel: `git status`, `git diff`, `git log`.
2. Stage relevant files; write an accurate English message.
3. Commit; verify with `git status`.
4. Reply with a **Korean detailed summary** of the changes (files, purpose, impact).
5. On hook failure: fix and create a **new** commit (do not amend a failed commit).
