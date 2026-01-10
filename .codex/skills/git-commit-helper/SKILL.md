---
name: git-commit-helper
description: Build-gated helper that writes a conventional English commit message and runs git commit.
metadata:
  short-description: Build-gated conventional commit helper
---

# Git Commit Helper

Turns current workspace changes into a clean, standards-compliant commit: first ensure the project builds, then review diffs and recent commit style, then write a Conventional Commits–style English commit message and run `git commit`.

## Workflow

1. Run `npm run build`
   - If it fails: stop, show the error output, explain likely causes, and suggest next fixes
2. Run `git status` to review the workspace state
3. Run `git diff --staged` and `git diff` to read all changes
4. Run `git log --oneline -5` to match the repo’s recent commit style
5. Summarize the change and generate a commit message
6. If nothing is staged: ask whether to run `git add -A` (or selectively add files)
7. Run `git commit -m "<title>" -m "<body...>"`

## Commit message rules

- Write in English
- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, etc.
- Title (first line) ≤ 50 characters, describing the main change
- Blank line between title and body
- Body uses bullet points for concrete changes / impact / key rationale
- Do not add “Generated with …” style markers
- Do not add `Co-Authored-By`
