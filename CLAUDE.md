# LocalBolt v3 — Claude Code Instructions

## SRE Protocol (STRICT — No Exceptions)

Every change to this project MUST follow strict SRE discipline. These rules apply to ALL Claude agents working in this repo.

- **No uncommitted work leaves your session.** Before ending any task, ALL changes must be staged and committed. No loose files, no "I'll commit later."
- **Working tree must be clean when you're done.** Run `git status` before and after work. Zero untracked or modified files when you finish.
- **If you touch it, git tracks it.** Every file modification, creation, or deletion must be reflected in a commit. Nothing happens off-the-books.
- **Never commit secrets.** No API keys, passwords, tokens, `.env` files, or credentials in any commit. Check `git diff --cached` before committing.

## Commit Protocol (MANDATORY)

Every commit made by any Claude instance MUST follow this exact workflow:

### 1. Hash
- Run `git rev-parse HEAD` after every commit and record the short + full hash.
- Include the short hash in any summary output to the user.

### 2. Tag
- Every commit MUST be tagged: `v3.0.<N>-<slug>` where `<N>` is the next sequential patch number and `<slug>` is a 2-4 word kebab-case summary of the change.
- Check existing tags with `git tag --list 'v3.0.*'` to determine the next number.
- Tags are **immutable** — never move or delete a pushed tag.
- Push tags with `git push origin <tag>`.

### 3. Comment
- Every commit message MUST include:
  - A concise imperative subject line (< 72 chars)
  - A blank line followed by a body explaining **what changed and why**
  - A `Files changed:` section listing modified files
  - The `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` trailer

### 4. Docs Sync (Subagent)
- After every commit, spawn a **background subagent** (Task tool, subagent_type=general-purpose) that:
  1. Reads the diff of the commit just made (`git diff HEAD~1 HEAD`)
  2. Updates `docs/CHANGELOG.md` with the new entry (tag, date, hash, summary, files changed)
  3. Updates `docs/STATE.md` to reflect the current project state
  4. Commits the doc updates as a separate commit: `docs: sync after <tag>`
  5. Tags the docs commit: `<tag>-docs`
- The docs subagent MUST NOT modify any source code — only files under `docs/`.

## Project Context

- **Repo**: LocalBolt v3 — Encrypted P2P file transfer (WebRTC + Tauri native apps)
- **Stack**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TweetNaCl, Rust (signaling + Tauri)
- **Monorepo**: npm workspaces — `packages/localbolt-web`, `packages/localbolt-signal` (Rust crate)
- **Apps**: `apps/tauri` (Tauri v2 — iOS, Android, macOS, Windows, Linux)
- **Branch**: `main` (single branch, linear history preferred)

## Architecture

- **Signaling**: Custom Rust WebSocket server (replaces Supabase). IP-based peer grouping for device discovery.
- **Encryption**: TweetNaCl NaCl box (Curve25519 + XSalsa20-Poly1305). Per-chunk random nonce.
- **Transfer**: WebRTC data channel, 16KB chunks, reliable + ordered.
- **Discovery**: WS server groups same-IP peers (web), mDNS for Tauri offline mode.
- **Future**: Nostr relays for global reach (not implemented yet).

## Code Standards

- Use shadcn/ui components from `packages/localbolt-web/src/components/ui/`
- Follow existing Tailwind patterns
- TypeScript strict mode — no `any` types without justification
- Rust code follows standard `cargo fmt` + `cargo clippy` conventions

## Do NOT

- Modify files outside the current task scope
- Add dependencies without explicit user approval
- Skip the tag/hash/docs workflow for any commit
- Use `git push --force` or destructive git operations
