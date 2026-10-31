# ADR 0014 — Show the run flow from the session, not the pane

- **Status:** accepted
- **Date:** 2026-10-25

## Context

The panel could answer "what was the answer?" (`final`), "what changed?"
(`diff`), and "what did it write down?" (`result`). It could not answer "what
did the child actually do?". A child that was still working, or that failed
before producing a final message, showed `(no final message yet)` and nothing
else — the screenshot that started this work had a `failed` row with no
explanation at all.

The data already existed. `herdr_read_agent` pages the pi session JSONL into
user/assistant turns with their tool calls; the tool result entries also carry
`toolName`, `isError`, and `durationMs`. The panel simply had no route to it.

## Decision

- Add **`flow`** as a fourth detail tab, backed by a new read-only
  `GET /herdr/api/transcript` (`target`, `from`, `limit`, `tail`). The route
  reuses `TranscriptService`, so the panel and `herdr_read_agent` read one
  format and remote tasks use the same SSH/mount file path.
- Enrich the transcript turn with the information the panel needs: tool calls
  become `{ name, detail }` with a one-line argument preview (the bash command,
  the edited path), and `toolResult` entries become role `tool` with
  `toolName` / `isError` / `durationMs`.
- Load the **newest** page first (`tail=1`), page backwards with `prevFrom`,
  and refresh every 4s while the child is `starting`, `working`, `running`, or
  `blocked`. A tail refresh merges into the turns already loaded so a user who
  paged back does not lose their place.
- Open a `failed` row directly on `flow`, and surface `record.error` in the
  `final` tab and in the `NO_TRANSCRIPT` message.
- Pure helpers (`mergeFlow`, `formatFlowText`) live in the client bundle above
  the components and are extracted by tests, following the existing
  `client-packet.test.mjs` pattern.

## Consequences

- **Good:** the panel shows the real sequence — commands, writes, failures,
  timings — with no ANSI scraping and no scrollback ambiguity.
- **Good:** a running child is legible without leaving the sidebar, and a
  spawn-time failure explains itself.
- **Good:** the same server-side truncation (6,000 chars/turn, 100 turns/page)
  bounds what a long session can do to the browser.
- **Bad:** only `kind=pi` has a session, so `agy` and friends still fall back to
  the read-only pane tail.
- **Bad:** the session is a pi implementation detail; a future pi format change
  breaks both the tool and the panel (they share the parser, which limits the
  blast radius).
- **Bad:** 4s polling is not a stream. A child that emits nothing for a while
  looks idle even while it is thinking.
- **Bad:** the panel downloads prompts and tool output into the browser. It is
  same-origin, read-only, and local, but it is still task content in a web page.
- **Bad:** adding the route requires an app restart; a page refresh only reloads
  the client bundle.

## Alternatives

- **Scrape the pane tail into the flow:** rejected. ANSI, wrapping, and missing
  tool boundaries make it lossy; the pane is the fallback when no session exists.
- **Embed a terminal in the panel:** rejected. Large surface, input handling, and
  it duplicates what `herdr agent read` already gives the tool layer.
- **Push updates over SSE/WebSocket:** deferred. The server has no push plumbing
  today, and a 4s poll is enough to watch a turn arrive.
