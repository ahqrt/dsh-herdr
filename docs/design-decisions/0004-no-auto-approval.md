# ADR 0004 — Never auto-approve; mutate only owned panes

- **Status:** accepted
- **Date:** 2026-10-20

## Context

Herdr reports `blocked` when a child shows an approval or question UI. A fleet manager could answer it automatically to keep throughput up. The plugin can also see every pane in the session, not only the ones it created.

## Decision

1. A `blocked` child is returned to DSH with the question. The plugin never approves, answers, or dismisses it. The model is instructed to ask the user and relay the answer with `herdr_message_agent`.
2. `close` and `interrupt` require a registry record. Before mutating, the live agent is looked up and the pane id must still match; otherwise the call is refused with `TASK_NOT_OWNED`.
3. `enabled: false` refuses new spawns but never kills running agents.

## Consequences

- **Good:** the human remains the approval authority; a prompt-injected child cannot escalate itself.
- **Good:** a user's pane can never be closed by a confused model.
- **Bad:** throughput depends on a human when a child asks a question. That is the correct trade for a tool that runs commands as the user.
- **Bad:** stale records after a Herdr restart may occasionally refuse a close; the error tells the user to use the Herdr UI.

## Alternatives

- **Auto-approve safe-looking questions:** rejected. "Safe-looking" is a model judgment over untrusted text.
- **Auto-close panes on task completion:** rejected. The pane is the audit trail and the takeover surface.
- **Ownership by pane-id prefix:** rejected. Pane ids are recycled; the registry plus a live-agent check is stronger.
