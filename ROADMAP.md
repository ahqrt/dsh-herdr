# Roadmap

The 0.1 line is deliberately narrow: delegate, harvest, review. Everything else
has a place below, roughly in order of value.

## 0.2 — close the loop

- **Inbound inbox** (`herdr_inbox`): consume `<taskDir>/inbox.ndjson`, long-poll,
  and surface `COMPLETE / BLOCKED / REVIEW_REQUEST` without a synchronous wait.
- **Push delivery**: wake an idle DSH session when a child settles, if the host
  exposes a stable injection API. Until then: inbox + desktop notification.
- **Queue** above `maxParallelAgents`: FIFO with a drain loop, so a batch of
  spawns does not fail on the cap.
- **Per-task worktree** (`isolated: true`): `herdr worktree create`, run there,
  return the worktree path; merging stays a human decision.
- **`herdr_read_agent`**: transcript paging for long answers, instead of only the
  truncated `finalMessage`.

## 0.3 — transports and hosts

- **Socket/event transport**: subscribe to Herdr state events instead of polling;
  implement `HerdrTransport` again and select it in `index.ts`.
- **Remote Herdr** (`herdr --machine`): per-machine registry namespaces and
  absolute-path rules.
- **Native subagent provider**: wrap the services in DSH's `ctx.subagents`
  provider so delegations show as first-class subagent cards.
- **Client UI panel**: a fleet view and per-task diff viewer, consuming the same
  `AgentResult` contract.

## 1.0 — stable contract

- Freeze the tool names, parameters, `AgentResult` fields, and error codes.
- State migration tooling for every `schemaVersion` bump.
- Documented compatibility matrix for at least two DSH minor lines.
- A second host adapter (to prove the port boundary is real).

## Explicitly not planned

- Auto-approving blocked agents.
- Auto-merging worktrees or pushing branches.
- Replacing DSH's in-process subagent for ordinary work.
- A general-purpose terminal automation layer; use Herdr's CLI directly.

## How to influence this

Open a [feature request](https://github.com/ahqrt/dsh-herdr/issues/new?template=feature_request.yml)
with the workflow you want to run, not only the API you want. Workflow evidence
moves an item up faster than a +1.
