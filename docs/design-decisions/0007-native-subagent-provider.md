# ADR 0007 — Native subagent provider as an opt-in adapter

- **Status:** accepted
- **Date:** 2026-10-21

## Context

DSH's `ctx.subagents` service owns the delegation catalog, cards, cancellation,
and settlement notices. Its external-provider contract is small: `start(request)`
returns `{ id, result, dispose }`, where `result` resolves `{ output, stopReason }`.
The rich `herdr_*` path returns far more (diff, session, artifacts, blocked
questions), but it does not appear in DSH's native subagent UI.

## Decision

Register a `herdr` subagent provider when `nativeSubagent` is true (default).
It is an **adapter**, not a replacement:

- `start()` calls `SpawnService.spawn({ wait: false })`, returns immediately, and
  settles in the background with `waitForSettle` + `HarvestService`.
- `output` is the final assistant text; `stopReason` is `stop`, `error`, or
  `aborted`. A blocked child becomes an `error` terminal carrying its question.
- `dispose()` interrupts and closes the owned pane.
- Capabilities are conservative: no `agentOptions`, preset, structured output,
  or depth enforcement; `inheritsParentContext` is false.
- The provider is selected only when a `dsh-tool-subagent` row sets
  `provider: herdr` with its own `toolName`. The default `subagent` row keeps
  using the in-process `spawn` provider.

## Consequences

- **Good:** users who want native cards get them without changing the rich
  tools; both surfaces coexist.
- **Good:** the provider reuses the spawn/harvest/lifecycle services, so gating,
  machines, and SSH file access apply unchanged.
- **Bad:** the native result is text-only; diff/session evidence stays on
  `herdr_spawn_agent`.
- **Bad:** capability negotiation is conservative; a tool row requesting
  agentOptions/preset/structured output is rejected by the service rather than
  silently ignored.
- **Bad:** the provider lives in this package but depends on DSH's rc provider
  contract; a host change is a small adapter fix, not a service refactor.

## Alternatives

- **Replace `herdr_spawn_agent` with the native tool:** rejected; it would lose
  the review packet that is the plugin's main value.
- **Use `prepareContinuable` (local child):** rejected; Herdr agents are external
  processes without a local DSH session to continue.
- **Emit one subagent card per delegation without the service:** rejected; the
  service owns catalog and cancellation invariants.
