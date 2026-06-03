---
name: git-commit
description: >-
  Create git commits when the user asks (커밋해줘, 커밋 해줘, commit, git commit,
  commit this). Always commit in English with basic commit safety rules.
---

# Git commit (English, basic rules)

Apply when the user requests a commit (including **커밋해줘**).

## Requirements

- **English commit messages** only (1–2 sentences; match recent `git log` style).
- Commit **only when explicitly asked**; never push unless asked.
- **Never** update `git config`, skip hooks, force push, hard reset, or commit secrets.
- Avoid `git commit --amend` unless the user requests it and amend preconditions are met.

## Workflow

1. Parallel: `git status`, `git diff`, `git log`.
2. Stage relevant files; write an accurate English message.
3. Commit; verify with `git status`.
4. On hook failure: fix and create a **new** commit (do not amend a failed commit).
