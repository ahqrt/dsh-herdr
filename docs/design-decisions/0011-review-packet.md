# ADR 0011 — Review packet assembled in the browser

- **Status:** accepted
- **Date:** 2026-10-21

## Context

A finished task already has a detail payload: metadata, summary, final message,
diff, and `result.md`. Users want to paste one block into a PR or handoff note
without copying four fields separately.

## Decision

- `buildPacket(task)` lives in the client and composes Markdown from the existing
  `/herdr/api/task` payload.
- The host only gained a `summary` field parsed from `result.md`; there is no
  `/packet` endpoint and no new mutation.
- The packet uses `~~~diff` fences so a diff containing triple backticks cannot
  break the block.
- Copy uses `navigator.clipboard.writeText`; failure is reported as a notice and
  nothing else changes.

## Consequences

- **Good:** one payload serves the panel and the packet; no duplicated
  serialization on the host.
- **Good:** packet shape can change with the UI without a host release.
- **Bad:** very large diffs produce a very large clipboard payload; each section
  is already capped at 300k by the API.
- **Bad:** no server-side template selection; 0.10 can add client-side templates.
- **Bad:** clipboard permissions vary by browser/context; localhost works, some
  remote HTTP origins do not.

## Alternatives

- **Server `/packet` endpoint:** rejected; it would duplicate the detail payload
  and need its own truncation rules.
- **Download a `.md` file:** deferred; clipboard is the immediate need.
- **Put the packet in the tool result:** rejected; the packet is a UI affordance
  and the model already gets the same evidence.
