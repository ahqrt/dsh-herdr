# ADR 0009 — Panel actions reuse the lifecycle gates

- **Status:** accepted
- **Date:** 2026-10-21

## Context

The 0.6 panel was read-only. Interrupting or closing from the fleet is the
natural next step, but a browser endpoint must not become a second, weaker path
to pane control.

## Decision

- `POST /herdr/api/action` accepts `{ action: "interrupt" | "close", target,
  force? }`.
- The route requires a same-origin request, `content-type: application/json`,
  and `x-herdr-panel: 1`. The custom header forces a CORS preflight for
  cross-origin callers and blocks simple-form CSRF.
- The handler calls `LifecycleService.interrupt` / `close`; it does not call a
  transport directly. Unowned tasks, changed panes, and active closes without
  `force` therefore fail with the same errors as the tools.
- Close from the UI confirms first and sends `force: true`; the session file is
  retained.
- Error codes map to HTTP: `TASK_NOT_OWNED` 403, `TASK_NOT_FOUND` 404,
  `VALIDATION_ERROR` 409, timeout 504.

## Consequences

- **Good:** one ownership implementation; a future tool fix also fixes the
  panel.
- **Good:** the audit log records panel actions exactly like tool actions.
- **Good:** a malicious cross-origin page cannot post a simple form.
- **Bad:** a same-origin XSS could act as the user; the web origin is the trust
  boundary.
- **Bad:** actions are synchronous request/response; a slow Herdr call holds the
  HTTP request. Acceptable for one pane.

## Alternatives

- **Direct transport calls from the route:** rejected; duplicates the ownership,
  pane-identity, and active-status gates.
- **Typert remote methods:** deferred; the HTTP route is smaller for two
  mutations.
- **A separate confirmation endpoint:** rejected; confirmation is a UI concern,
  and `force` is explicit in the payload.
