# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
