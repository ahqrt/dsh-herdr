# ADR 0010 — Read-only live tails and client-side bulk actions

- **Status:** accepted
- **Date:** 2026-10-21

## Context

The fleet contains agents this plugin did not spawn. They have no task record, so
the review packet endpoints cannot describe them. Users still want to see what
those panes are doing. Separately, acting on many owned tasks one by one is
tedious.

## Decision

- `GET /herdr/api/live?target=…&machine=…` resolves the transport, calls
  `getAgent`, then `readAgent` (100 lines, `recent-unwrapped`), and returns a
  tail. It never calls `sendKeys`, `closePane`, or a lifecycle mutation.
- External agents are therefore read-only in the panel: no interrupt/close
  controls are rendered, and the host has no endpoint that would accept them
  without an owned record.
- Bulk interrupt/close is a **client-side loop** over the single-task action
  endpoint, with one confirmation. Each task still passes the lifecycle gates
  independently; the panel reports partial failures per task.

## Consequences

- **Good:** one read path covers owned and external agents without inventing
  records for panes we do not own.
- **Good:** bulk needs no new server contract and cannot bypass a per-task gate.
- **Bad:** pane tails can contain secrets or unrelated user output; the web
  origin is the trust boundary.
- **Bad:** N selected tasks means N sequential HTTP calls. Acceptable for a
  handful; a batch endpoint would need per-target result plumbing.
- **Bad:** the live tail is a snapshot; the panel re-reads on demand, not on a
  streaming subscription.

## Alternatives

- **Create shadow task records for external panes:** rejected; it would blur
  ownership and invite accidental mutation.
- **One bulk server endpoint:** deferred; the per-task gate is the valuable part,
  and partial-failure reporting would be more complex.
- **Stream pane output over SSE/WebSocket:** deferred; a pull is enough for a
  side panel.
