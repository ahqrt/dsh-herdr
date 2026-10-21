# ADR 0008 — Read-only web panel over same-origin HTTP

- **Status:** accepted
- **Date:** 2026-10-21

## Context

The tools already return a review packet, but seeing the fleet and a task's diff
requires asking the model or opening files. DSH's web client offers slots and a
right-sidebar tab registry. The host can expose data through DSH RPC
(Typert/remotes) or through an HTTP route served by `webServer`.

## Decision

- The host registers `/herdr/api/{health,fleet,task}` through `webServer` using
  dynamic inject, so headless profiles still load.
- The route is **read-only**, same-origin checked, and sends `no-store`.
- The browser half is a hand-written client module (`client/index.js` copied to
  `lib/client.js`) that registers a `sidebarRightTabs` type and the
  `sidebar.right.pane.tab` slot. It polls `/herdr/api/fleet` every 10s and
  fetches one task on selection.
- The panel displays the final message, `result.md`, and the local diff patch.
  Mutations (interrupt/close) stay in the tools, where ownership, audit, and
  error contracts already live.

## Consequences

- **Good:** no RPC schema to version; the panel and the tools can evolve
  independently.
- **Good:** the client is a plain React component with no build pipeline beyond
  a copy, so the package stays small.
- **Bad:** the panel is read-only in 0.6; acting from it needs a mutation
  endpoint with the same gates.
- **Bad:** polling spends one `herdr agent list` per 10s while the tab is open.
- **Bad:** the panel needs the web client's sidebar services; headless profiles
  simply never mount it.

## Alternatives

- **Typert remote service:** rejected for v1; more contract surface for three
  GETs.
- **A standalone dashboard page:** rejected; it would not live where the user
  works.
- **Mutating endpoints in 0.6:** deferred until they can reuse the tool gates
  rather than duplicate them.
