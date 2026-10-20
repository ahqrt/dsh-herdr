# ADR 0001 — Use the Herdr CLI, not the socket API

- **Status:** accepted
- **Date:** 2026-10-20

## Context

Herdr exposes two interfaces: a documented `herdr` CLI (JSON envelopes) and a private socket API (protocol 22 at the time of writing). The socket is faster and event-driven; the plugin needs `agent start/prompt/wait/get/list/read`, `pane split/close`, `tab create`, and `workspace create`.

## Decision

All Herdr interaction goes through the CLI, spawned without a shell. A single module (`src/adapters/herdr/cli.ts`) owns the process, timeout, abort, JSON envelope, and version floor. `HerdrTransport` hides the CLI from services.

## Consequences

- **Good:** the contract is documented and stable; bracketed-paste submission, `blocked` rejection, and `--wait` semantics are Herdr's own, not reimplemented; no protocol-version coupling.
- **Good:** one process per call is cheap at interactive rates, and an abort maps to `SIGTERM` cleanly.
- **Bad:** no event subscription; waiting is `--wait` plus a poll fallback (`herdr_get_agent_result`). A future event/push adapter would need the socket.
- **Bad:** response shapes are parsed defensively (snake_case, wrapper keys), and a CLI change is an adapter fix.

## Alternatives

- **Socket only:** rejected. The private protocol already differs between client 0.9.4 and server 0.9.1; a plugin should not pin that.
- **MCP server:** rejected for 0.1.x. It would add a hop and lose `exec.signal` and the session cwd; a later portability option.

## Revisit when

Herdr publishes a stable socket/event API, or waiting becomes a latency problem at fleet scale. The port boundary makes this a single-adapter change.
