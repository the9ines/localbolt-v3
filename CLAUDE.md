# LocalBolt v3 — Claude Code Instructions

> Ecosystem governance is canonical at the workspace root: `bolt-ecosystem/CLAUDE.md`
> (SRE policy, commit/tag discipline, No-Push Policy, documentation homes) plus
> `bolt-ecosystem/os/rules/`. This file adds only what is specific to localbolt-v3.
> **Where this file and the root conflict, the root wins.**

## SRE Protocol

Follow the root SRE policy strictly. Repo-specific notes:

- Working tree clean before and after every task. Check tracked files with
  `git diff --name-only HEAD` — avoid full `git status` scans; this workspace sits
  on iCloud-synced Desktop and untracked-file scans can hang on cloud-only files.
- Never commit secrets. Review `git diff --cached` before every commit.

## Commit Protocol

- Imperative subject under 72 chars; body explaining what changed and why;
  `Files changed:` section listing modified files.
- Commit messages MUST NOT include `Co-Authored-By` trailers (root rule).
- Run `git rev-parse HEAD` after every commit; report the short hash.
- Tag format: `v3.0.<N>-<slug>` — next N via `git tag --list 'v3.0.*' | sort -V | tail -1`.
  Tags are immutable once pushed. Whether every commit or only releases get tagged is
  a pending PM decision (see ecosystem `os/NOW.md`) — when in doubt, ask.
- **Do NOT push commits or tags.** Pushes require explicit human authorization
  (root No-Push Policy).

## Documentation

- Append release entries to `docs/CHANGELOG.md` in the same commit as the work.
- `docs/STATE.md` is retired. Current state is generated at the ecosystem root
  (`os/bin/status.sh` → `os/DASHBOARD.md`). No docs-sync commits, no `-docs` tags,
  no docs subagents.

## Project Context

- **Repo**: LocalBolt v3 — encrypted P2P file transfer web app, deployed at localbolt.app
- **Stack**: Vanilla TypeScript, Vite, Tailwind CSS, Rust (signaling)
- **Monorepo**: npm workspaces — `packages/localbolt-web`, `packages/localbolt-signal` (Rust crate)
- **Native app**: lives in the `localbolt-app` repo in the ecosystem workspace, not here
- **Branch**: `main` (single branch, linear history preferred)
- Deeper architecture facts live in `README.md`, the code, and the workspace
  `ARCHITECTURE.md` — do not restate protocol/transport claims here, where they rot.

## Code Standards

- Use shadcn/ui components from `packages/localbolt-web/src/components/ui/`
- Follow existing Tailwind patterns
- TypeScript strict mode — no `any` types without justification
- Rust code follows standard `cargo fmt` + `cargo clippy` conventions

## Do NOT

- Modify files outside the current task scope
- Add dependencies without explicit user approval
- Use `git push --force` or destructive git operations
- Hand-write state, version, or status claims into any doc that claims to be current
