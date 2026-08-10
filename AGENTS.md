# Agent Instructions

## Master plans

Read [`master-plans/00-master-plan.md`](master-plans/00-master-plan.md) first,
before any other work. It explains how master plans are used and maintained.
Then find every plan in [`master-plans/`](master-plans/) relevant to your task
and read each one in full before starting.

Master plans are dictated by the user and describe where the project is going,
in what order, and what counts as done. They outrank conclusions drawn from the
existing code. Do not create, edit, rename, or delete a file in `master-plans/`
unless the user explicitly asks for that change in the current task. When the
code contradicts a master plan, report the contradiction instead of revising
the plan.

All persistent plans must live in `master-plans/`. Supporting discussion notes
belong only in `master-plans/notes/`; do not create planning documents elsewhere
in the repository.

## Project

This repository is Steve's TypeScript standard-library workspace: a small
collection of verified implementations, adapted copies, and wrappers that
agents can reuse. Keep it framework-independent and friendly to tree shaking in
web builds. Packages live under `packages/`.

## Package manager and tooling

- Use `pnpm`; do not use npm or Yarn for dependency or script operations.
- Use TypeScript for source code and Vite for library builds.
- Run `pnpm check` before handing off a change.
- Keep code formatted with oxfmt and clean under oxlint.

## Library design

- Export each package's public APIs through its `sources/index.ts`.
- Pass `Context` as the first argument to every function that needs it and name
  that argument `ctx`, including in callback signatures and examples.
- Prefer focused modules with explicit types. Avoid import-time side effects
  except for installing direct getters for built-in context namespaces.
- Keep browser-facing code portable; do not add Node-only assumptions to shared
  modules without isolating them behind a dedicated entry point.
- Put built-in context implementations in their domain's `impl/` directory.
  Keep each namespace and its private storage key in one file, and name built-in
  storage keys with the `stdlib.<name>` prefix.
- Add deterministic tests with behavior changes once a test runner is present.

## Repository safety

Do not commit or push changes unless the user explicitly asks in the current
task. Preserve unrelated local changes.
