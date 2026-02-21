# AGENTS Guide

This file describes the minimum working conventions for contributors and coding agents.

## Project Structure

- `src/engine/`: Core game engine (turns, units, abilities, floor/space logic)
- `src/runtime/`: Python player runtime bridge and execution layer
- `src/levels/`: Level definitions (JSON) and schema parsing
- `src/web/`: Frontend UI
- `tests/`: Unit/integration tests (engine, runtime, levels)
- `.github/workflows/`: CI, Codecov, CodeQL, Sonar workflows

## Local Setup

```bash
npm ci
```

## Build and Test

```bash
npm test
npm run build
npm run dev
```

Notes:
- Run focused tests first when possible, then run full `npm test` before opening a PR.
- Keep documentation and level tips consistent with actual runtime behavior.

## Commit Conventions

- Use small, focused commits.
- Prefer Conventional Commits (e.g. `feat:`, `fix:`, `docs:`).
- Include in commit message body:
  - Why the change is needed
  - Affected scope
  - Whether there is any breaking change

## Preview / Dev Server

- `preview_*` ツール（Claude Preview MCP）はサンドボックス環境の制限により動作しない。
- UI 変更の確認には `npm run dev` のローカル起動、または `npm run build` の成功を検証手段とする。
- Stop hook の「Preview Required」警告が出ても `preview_start` を呼ばないこと。

## Branch and PR Conventions

- Do not push directly to `main` (except initial repository setup).
- Create a topic branch such as:
  - `feature/<short-topic>`
  - `fix/<short-topic>`
  - `docs/<short-topic>`
- Before creating a PR:
  - Re-run `npm test`
  - Run `npm run lint` (ESLint + sonarjs) to catch code smells before SonarCloud review
  - Review changed files and descriptions for accuracy
- In PR description, include:
  - Summary of changes
  - Validation performed (tests/commands)
  - Impact and migration notes (if any)
