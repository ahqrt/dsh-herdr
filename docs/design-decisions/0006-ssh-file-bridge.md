# ADR 0006 — SSH file bridge for remote machines

- **Status:** accepted
- **Date:** 2026-10-21

## Context

`herdr --machine` forwards the API to a remote Herdr server, so agents can be
listed, prompted, and read remotely. Results, however, live in files: the pi
session JSONL, `result.md`, the git diff, and the task inbox. A local mount is
the easy answer, but it is a deployment requirement many users cannot meet.

## Decision

A remote machine gets a `MachineRuntime` with its own `MachineIo` and
`GitService`:

- `machineTargets: ["label=user@host"]` selects the SSH bridge.
- `SshMachineIo` runs one `ssh target sh -lc <command>` per operation, uses
  stdin for writes, quotes every path, and runs with `BatchMode=yes` so a
  password prompt fails instead of hanging a tool call.
- `RemoteGit` implements the existing `GitService` by running `git -C` over the
  same bridge; the patch is written locally for the reviewer.
- Task/worktree roots resolve under the remote `$HOME` (`remoteHomeDir`).
- The local mount (`sharedFilesystem`) remains as a fallback when no SSH target
  is configured.

## Consequences

- **Good:** remote spawn/harvest works with SSH key auth alone; no mount and no rsync daemon.
- **Good:** the same `GitService`/`MachineIo` contracts cover local, mounted, and
  SSH machines, so services do not branch on transport.
- **Bad:** one SSH process per operation adds latency (tens of ms). Acceptable
  for delegation lifecycle operations, not for per-keystroke work.
- **Bad:** remote paths must be POSIX and the remote shell must support `sh -lc`,
  `cat`, `mkdir -p`, and GNU/BSD `stat`. Windows remote hosts are not supported.
- **Bad:** host-key trust and key auth are the user's responsibility; the plugin
  never handles credentials.

## Alternatives

- **Mount-only:** rejected as the sole mechanism; it excludes SSH-only hosts.
- **rsync/scp per harvest:** rejected; a tarball transfer for a session tail is
  more failure modes than a single `cat`.
- **Remote Herdr writing results back through its API:** not available; the API
  exposes terminal state, not arbitrary files.

## Revisit when

Herdr exposes a file/artifact API over `--machine`, or when a remote host needs
Windows support.
