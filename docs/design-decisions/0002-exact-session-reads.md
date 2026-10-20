# ADR 0002 — Read the result from the session file, not the screen

- **Status:** accepted
- **Date:** 2026-10-20

## Context

The obvious way to harvest a Herdr agent's answer is `herdr agent read` and parse the pane. Terminal output is wrapped, styled, partially scrolled away, and may include TUI chrome after the answer. For a pi child, Herdr already exposes the session file path (`agent_session.value`).

## Decision

For `kind=pi`, the primary result is the **last assistant message in the session JSONL**, text blocks joined. `result.md` (written by the child under the task envelope) is the second source for every kind. Pane tail is the final fallback.

A message is only accepted when the session file's mtime is at or after `promptedAt - 1s`; otherwise it belongs to a previous turn and is ignored, with a warning.

## Consequences

- **Good:** byte-identical, complete, no ANSI, no scrollback limits; the full transcript path is returned for deeper review.
- **Good:** follow-up messages on the same session are safe because of the freshness check.
- **Bad:** couples the extractor to pi's JSONL shape. It is isolated in `src/domain/session.ts` with tolerant parsing (torn final line, unknown entry types) and a fixture test.
- **Bad:** non-pi kinds still need the pane tail. Their result is explicitly weaker; the contract says so rather than pretending.

## Alternatives

- **Pane scraping only:** rejected; it fails exactly when the answer is long or the pane has scrolled.
- **Ask the child to write a file only:** kept as the artifact contract, but not sufficient: children forget, and a missing file would lose the answer.
- **Both, with the session winning:** this decision.
