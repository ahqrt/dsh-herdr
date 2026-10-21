# ADR 0005 — Socket transport as an opt-in accelerator

- **Status:** accepted
- **Date:** 2026-10-21
- **Supersedes in part:** [0001](0001-cli-over-socket.md) (the CLI remains the default; the socket is now an opt-in transport)

## Context

Polling `agent get` every 700ms is audible on a busy fleet, and `herdr_get_agent_result(wait:true)` holds a tool call open for minutes. Herdr's socket API (protocol 22) exposes `agent.wait`, `events.*`, and the same command set as the CLI, so a request/response client can wait server-side.

The socket is a private protocol: it can change between client and server, and its schema is versioned separately from the npm package.

## Decision

Add `HerdrSocketClient` and `HerdrSocketTransport` behind `transport: cli | auto | socket` (default `cli`; `auto` and `socket` are opt-in).

- One connection per request, matching Herdr's own integrations. No multiplexed persistent socket, so a server-side close cannot poison later calls.
- `auto` uses the socket only when a connection succeeds; a connect failure degrades that instance to the CLI for the rest of the process. A mutation whose response was lost is **never** retried over the CLI.
- `socket` never falls back, for users who want to know when the protocol drifts.
- `probe`, `serverStatus`, and `kinds` stay on the CLI: version and kind discovery are client-local/stable surfaces.
- The socket is local-only. Remote machines always use the CLI's `--machine`.

## Consequences

- **Good:** `waitForSettle` no longer polls; long waits cost one socket request.
- **Good:** a daemon restart or stale socket degrades to the CLI instead of failing the delegation.
- **Bad:** the socket adapter is coupled to protocol 22 and to result shapes the CLI already hides.
- **Bad:** `auto` can only fall back on a *connect* failure; an I/O failure mid-request surfaces as `HERDR_UNAVAILABLE`, which is deliberate (no double mutation).

## Alternatives

- **Socket only:** rejected; protocol drift would take the whole plugin down.
- **CLI only:** still the safe default, but leaves the event wait unused.
- **Long-lived multiplexed socket:** rejected for the multiplexing/close-race it introduces; connection-per-request is cheap on a Unix socket.

## Revisit when

Herdr publishes a stable, documented socket protocol with a compatibility guarantee. Then `auto` can become the default without a CLI fallback, and `events.subscribe` can drive push delivery.
