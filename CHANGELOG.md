# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-10-21

### Added

- **Panel actions**: interrupt and close owned tasks from the fleet detail,
  with the same ownership gates as the tools; close asks for confirmation and
  force-closes the pane while retaining the session file.
- **Fleet filters**: owned/all toggle and a machine selector.
- **Diff navigation**: per-file sections with add/delete counts, collapsible
  bodies, and a raw/structured toggle.
- `POST /herdr/api/action` (JSON + `x-herdr-panel: 1`, same-origin) returning
  the lifecycle error code on refusal.

## [0.6.0] - 2026-10-21

### Added

- **Web panel**: a `Herdr` right-sidebar tab and guide entry showing the live
  fleet plus a selected task's final message, `result.md`, and diff. Read-only.
- `GET /herdr/api/health`, `/herdr/api/fleet`, `/herdr/api/task` (same-origin,
  no-store) behind the existing DSH web server.
- Client bundle (`lib/client.js`) and `dsh.client` metadata.

## [0.5.1] - 2026-10-21

### Changed

- Release-infrastructure verification for OIDC trusted publishing; no runtime
  code changes.

## [0.5.0] - 2026-10-21

### Added

- **Native subagent provider** `herdr`: register with `ctx.subagents` so a
  `@deepseek-ai/dsh-tool-subagent` row with `provider: herdr` routes through
  Herdr and gets the native catalog, cards, and cancellation.
- `nativeSubagent` and `subagentName` config keys; the provider is disabled by
  default only when `nativeSubagent: false`.
- Provider startup maps `start` to a non-blocking spawn; the result promise
  resolves from the Herdr settle + harvest (`stop`, `error`, `aborted`), and
  `dispose()` interrupts then closes the owned pane.

## [0.4.0] - 2026-10-21

### Added

- **SSH file bridge** for remote machines: `machineTargets: ["label=user@host"]`
  gives `spawn`/`harvest`/`inbox`/`transcript`/worktree access to the remote
  filesystem without a local mount. Artifacts and pi sessions are read over
  SSH; the diff patch is written locally for review.
- `remoteHomeDir` (default `~/.dsh/herdr`) for remote task/worktree roots.
- Doctor reports each machine's file access (`ssh`, `mounted`, or missing).

### Changed

- Remote spawn no longer requires `sharedFilesystem`; a mount is now the
  fallback when no SSH target is configured.
- SSH runs with `BatchMode=yes`; password prompts fail fast instead of hanging.

## [0.3.1] - 2026-10-21

### Fixed

- Correct the install version references in the README and docs shipped in the
  0.3.0 tarball. No code changes.

## [0.3.0] - 2026-10-21

### Added

- Opt-in **socket transport** (`transport: auto | cli | socket`): one connection
  per request over Herdr's Unix socket, with a CLI fallback when the socket
  cannot be reached. `agent.wait` is now server-side instead of polled.
- **Remote machines**: `machine` on spawn/list/result/message, `machines` and
  `sharedFilesystem` config, `--machine` forwarding, per-machine registry
  namespaces, and doctor checks. Remote spawn requires the remote filesystem to
  be mounted locally; remote observation and messaging work without it.

### Changed

- `herdr_get_agent_result(wait:true)` and `waitForSettle` use the server-side
  `agent wait` / socket `agent.wait` instead of a 700ms poll.
- Doctor reports configured machines and their reachability.

## [0.2.0] - 2026-10-20

### Added

- `herdr_inbox`: consume child → DSH messages from `inbox.ndjson`, with a
  long-poll `wait` and per-task read offsets (no replay).
- `herdr_read_agent`: page through a pi session transcript, turn by turn, with
  the tool calls each turn made.
- Spawn queue: over the concurrency cap, a spawn waits up to `queueTimeoutMs`
  for a slot instead of failing immediately; `queuedMs` is reported.
- `isolated: true`: run a task in a fresh git worktree (`dsh/<taskId>`), return
  its path, and optionally remove it on close (`remove_worktree: true`).
- `timing.queuedMs` and `worktree` in the result contract.

### Changed

- `herdr_spawn_agent` no longer rejects at the cap; it queues. The error now
  names the wait and the running agents.
- `herdr_close_agent` accepts `remove_worktree`.

## [0.1.0] - 2026-10-20

### Added

- Seven tools: `herdr_spawn_agent`, `herdr_get_agent_result`,
  `herdr_message_agent`, `herdr_list_agents`, `herdr_interrupt_agent`,
  `herdr_close_agent`, `herdr_doctor`.
- Exact pi result extraction from the session JSONL, with a freshness check
  against the prompt timestamp.
- `result.md` artifact contract for every kind; pane tail as the honest fallback.
- Git baseline at spawn and a bounded patch at harvest.
- Dedicated `DSH · <repo>` workspace with one tab per task; sibling split when
  DSH runs inside Herdr.
- Cross-process task registry with atomic writes, a stale-aware lock, and a
  corrupt-file quarantine.
- Model alias resolution from `~/.pi/agent/model-aliases.md`, with explicit
  kind capability rules (`pi` accepts model/thinking, `agy` refuses both).
- Idempotent spawns via `client_task_id`; concurrency cap; cwd allowlist.
- Typed error codes with remediation, structured audit log, and `herdr_doctor`.
- TypeScript source with a dependency-rule architecture, 66 tests including an
  end-to-end suite against a fake Herdr CLI, CI matrix, and release workflow.

### Known limitations

- No inbound push from child to DSH; the synchronous result is the channel.
- No queue above `maxParallelAgents`; over-cap spawns are refused.
- No per-task git worktree; no remote `--machine` forwarding.
- Non-pi kinds return pane text, not a structured transcript.
