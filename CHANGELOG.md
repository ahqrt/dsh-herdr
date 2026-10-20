# Changelog

All notable changes to this project are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
