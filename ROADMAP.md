# Roadmap

The 0.1 line is deliberately narrow: delegate, harvest, review. Everything else
has a place below, roughly in order of value.

## 0.2 — close the loop (shipped in 0.2.0)

- **Inbound inbox** (`herdr_inbox`): consume `<taskDir>/inbox.ndjson`, long-poll,
  and surface `COMPLETE / BLOCKED / REVIEW_REQUEST` without a synchronous wait.
- **Queue** above `maxParallelAgents`: wait for a slot (`queueTimeoutMs`), report
  `queuedMs`, and fail only when the wait expires.
- **Per-task worktree** (`isolated: true`): a fresh `git worktree` on
  `dsh/<taskId>`; the path is returned and cleanup is explicit.
- **`herdr_read_agent`**: transcript paging for long answers, instead of only the
  truncated `finalMessage`.
- **Push delivery** *(still open)*: wake an idle DSH session when a child
  settles. Blocked on a stable host injection API; the inbox long-poll is the
  current answer.

## 0.3 — transports and hosts (shipped in 0.3.0)

- **Socket/event transport**: a one-request-per-connection socket adapter with
  server-side `agent.wait`; opt-in via `transport`, CLI fallback on connect.
- **Remote Herdr** (`herdr --machine`): per-machine transports and registry
  namespaces, `machines` allowlist, doctor checks. Spawn requires a locally
  mounted filesystem; observation and messaging do not.
- **Remote file bridge**: fetch session/result files over SSH so remote spawn no
  longer needs a mount.
- **Native subagent provider**: wrap the services in DSH's `ctx.subagents`
  provider so delegations show as first-class subagent cards.
- **Client UI panel**: a fleet view and per-task diff viewer, consuming the same
  `AgentResult` contract.

## 0.4 — remote file bridge (shipped in 0.4.0)

- **SSH-backed runtime**: `machineTargets` gives spawn/harvest/inbox/transcript
  and worktrees access to the remote filesystem without a mount.
- **Doctor file-access mode**: `ssh`, `mounted`, or missing.
- **Mount remains a fallback** via `sharedFilesystem`.

## 0.5 — hosts and polish

- **Native subagent provider**: wrap the services in DSH's `ctx.subagents`
  provider so delegations show as first-class subagent cards.
- **Client UI panel**: a fleet view and per-task diff viewer consuming the same
  `AgentResult`.
- **Remote Windows**: only if Herdr supports it and a POSIX shell is available.

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
