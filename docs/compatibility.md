# Compatibility

## Support policy

| Surface | Promise |
|---|---|
| The nine tool names | Stable across `0.x`; removal/rename is a major. |
| Tool parameters | Additive within a minor; a renamed/removed parameter is a major. |
| `AgentResult` fields | Additive within a minor; `schemaVersion` bumps for breaking changes. |
| Config keys | Additive within a minor; a removed key is a major with a migration note. |
| Error codes | New codes are additive; changing an existing code's meaning is a major. |
| Internal modules | Not a public API. Import from the package root only. |

`0.x` still means "the public surface may move before 1.0", but it moves with a changelog entry and a migration note, not silently.

## 0.4.0 additions

Additive: `machineTargets`, `remoteHomeDir`, and SSH-backed task/session/diff
access for remote spawn. Remote machines must be POSIX with `sh`, `cat`,
`mkdir -p`, and `stat`; Windows remotes are unsupported.

## 0.3.0 additions

Additive: `transport`, `socketPath`, `machines`, `sharedFilesystem`,
`machine` on spawn/result/message/list, and `agent.machine` in the result.
The CLI remains the default transport; the socket is opt-in and protocol 22.

## 0.2.0 additions

Additive only: `herdr_inbox`, `herdr_read_agent`, `isolated`, `remove_worktree`, `worktree`, and `timing.queuedMs`. Existing tool names and parameters are unchanged; a 0.1 client that ignores the new fields still works.

## Tested matrix

| | Tested | Notes |
|---|---|---|
| DSH | `0.2.1-rc.2` | Headless `web` profile boot: all nine tools activated (the loader compiles every parameter/output schema). The tool and workingDirectory APIs are the only host dependencies. |
| Herdr client | `0.9.4` | Hard floor `0.9.0` (the `agent start --kind` contract). |
| Herdr server | `0.9.1` | Client/server protocol `22` at the time of writing. The opt-in socket adapter targets protocol 22 and falls back on connect failures. |
| Node | `22.22.3`, `24.x` in CI | ESM only; no native modules. |
| macOS | 14/15 (arm64) | Primary development platform. |
| Linux | CI (ubuntu-latest) | Unit + fake-herdr integration. |
| Windows | CI (windows-latest) | Unit tests; fake-herdr integration is skipped (POSIX shebang). Real Herdr usage is untested. |

## Herdr protocol caution

The plugin uses the **CLI**, not the private socket. That is deliberate: the socket protocol is versioned (currently 22) and can change between client and server, while the CLI keeps its documented flags. See [ADR 0001](design-decisions/0001-cli-over-socket.md).

If a future Herdr release changes a CLI response shape, the fix belongs in `src/adapters/herdr/transport.ts`; services and tools should not change.

## DSH release-candidate caveat

DSH `0.2.x` is an rc line. The host APIs the plugin relies on are intentionally minimal:

- `ctx.tools.register(tool)` from `@deepseek-ai/dsh-tools`' `defineTool`;
- `ctx.workingDirectory.ensure(agent)` when present;
- `exec.signal` and `exec.agent.session.header.cwd` as fallbacks.

If DSH changes one of these, only `src/index.ts`, `src/tools/*`, and `src/host.ts` are affected.

## Model aliases

The alias file is user-owned; the plugin makes no compatibility promise about its contents. Missing aliases produce a `VALIDATION_ERROR` listing what is known. Raw `provider/model` ids always work.

## Kind support

| Kind | Launch | Model / thinking | Exact result |
|---|---|---|---|
| `pi` | full | `--model`, `--thinking` | session JSONL |
| `agy` | full | refuses both | pane tail |
| `claude`, `codex`, `gemini`, … | via `agent_args` | via `agent_args` | pane tail (session extraction may exist later) |

Adding first-class support for a kind means: a `kindCaps` entry, a tested argv builder, and a result extractor if the kind exposes a transcript path.

## Node and package manager

- Node `>=22`. The package is ESM (`"type": "module"`).
- Development uses pnpm (`packageManager` field). npm works for `npm pack` but the lockfile is pnpm's.
- No runtime dependencies. `typescript` and `@types/node` are dev-only.

## Deprecation

A deprecated parameter or field is documented in [CHANGELOG.md](../CHANGELOG.md), kept for at least one minor release, and emits a warning in the result when used. Silent removal is a bug.
