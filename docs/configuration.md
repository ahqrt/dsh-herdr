# Configuration

The plugin is configured through the DSH profile's `cordis.patch.yml`. Defaults are safe; override only what you need. The schema lives in [`src/config.ts`](../src/config.ts), and the pure merge (with clamping) in [`src/defaults.ts`](../src/defaults.ts).

## Example

```yaml
- id: tool-herdr
  name: dsh-herdr
  config:
    enabled: true
    transport: cli           # cli | auto | socket
    socketPath: ~/.config/herdr/herdr.sock
    defaultKind: pi
    defaultModel: flash
    nativeSubagent: true
    subagentName: herdr
    # panel "open editor": command plus fixed args; empty hides the button
    editorCommand: ""
    editorArgs: []
    maxParallelAgents: 3
    queueTimeoutMs: 300000
    maxQueuedAgents: 10
    defaultTimeoutMs: 900000

    # keep delegations inside these directories (empty = no restriction)
    allowCwd:
      - ~/Desktop
      - ~/code

    # enabled herdr --machine profiles; only these labels are reachable
    machines: []
    # SSH file access for remote machines: "label=user@host"
    machineTargets: []
    # optional: machines whose filesystem is mounted here (instead of SSH)
    sharedFilesystem: []
    # remote root for tasks/worktrees (under the remote $HOME)
    remoteHomeDir: ~/.dsh/herdr

    # auto: split when DSH runs inside Herdr, otherwise a dedicated workspace
    topology: auto
    workspaceLabel: "DSH · {repo}"

```

## Keys

| Key | Type | Default | Effect |
|---|---|---|---|
| `enabled` | boolean | `true` | `false` refuses every spawn. Does not kill running agents. |
| `herdrBin` | string | `herdr` | Path to the Herdr CLI. `HERDR_BIN` is the environment fallback. |
| `transport` | `cli` \| `auto` \| `socket` | `cli` | `auto` tries the local socket and degrades to CLI; `socket` never falls back. |
| `socketPath` | string | `~/.config/herdr/herdr.sock` | Local socket. `HERDR_SOCKET_PATH` overrides. |
| `machines` | string[] | `[]` | Herdr `--machine` labels/ids the tools may target. |
| `machineTargets` | string[] | `[]` | Remote machines with SSH file access, as `label=user@host`. Needed for remote spawn/harvest without a mount. |
| `sharedFilesystem` | string[] | `[]` | Machine labels whose filesystem is mounted locally; the fallback when no SSH target is configured. |
| `remoteHomeDir` | string | `~/.dsh/herdr` | Task/worktree root on SSH machines, resolved against the remote `$HOME`. |
| `defaultKind` | string | `pi` | Kind used when `kind` is omitted. |
| `defaultModel` | string | `flash` | Alias/ID used for `kind=pi` when `model` is omitted. Empty = pi's own default. |
| `nativeSubagent` | boolean | `true` | Register the `herdr` provider with DSH's subagent service. |
| `subagentName` | string | `herdr` | Provider name a `dsh-tool-subagent` row selects. |
| `editorCommand` | string | `""` | Command the panel's **open editor** action spawns with the task cwd; empty hides the button. |
| `editorArgs` | string[] | `[]` | Fixed argv inserted before the cwd. The command is spawned directly, never through a shell. |
| `aliasesFile` | string | `~/.pi/agent/model-aliases.md` | The markdown alias table. Missing file = only raw IDs resolve. |
| `maxParallelAgents` | number | `3` | Concurrency cap. New spawns wait for a slot up to `queueTimeoutMs`. |
| `queueTimeoutMs` | number | `300000` | Max wait for a slot; `0` fails immediately. |
| `maxQueuedAgents` | number | `10` | Max waiters in this process; beyond that, `CONCURRENCY_LIMIT`. |
| `defaultTimeoutMs` | number | `900000` | Default wait budget (10s–1h). |
| `startTimeoutMs` | number | `60000` | Agent boot budget (5s–5min). |
| `maxResultChars` | number | `40000` | Truncation for `finalMessage` / `resultText`. |
| `maxDiffBytes` | number | `524288` | Truncation for `diff.patch`. |
| `topology` | `auto` \| `workspace` \| `split` | `auto` | Where panes are created. |
| `splitDirection` | `right` \| `down` | `right` | Used only by `split` topology. |
| `workspaceLabel` | string | `DSH · {repo}` | Template; `{repo}` is the cwd basename. |
| `homeDir` | string | `~/.dsh/herdr` | Root for state, audit, and artifacts. |
| `artifactsRoot` | string | `tasks` | Relative to `homeDir`, or absolute / `~`. |
| `worktreesRoot` | string | `worktrees` | Where `isolated:true` worktrees are created. |
| `stateFile` | string | `state.json` | Relative to `homeDir`, or absolute / `~`. |
| `auditFile` | string | `audit.ndjson` | Relative to `homeDir`, or absolute / `~`. |
| `allowCwd` | string[] | `[]` | Hard boundary. Empty means "any directory". |

## Model aliases

`aliasesFile` is the same table used when working with pi by hand:

```markdown
| 别名 | `--model` | 计费 | thinking |
|---|---|---|---|
| `grok4.7` | `xai/grok-4.7` | xAI 订阅 | high / medium / low |
| `flash` | `commandcode/deepseek/deepseek-v4.1-flash` | commandcode credits | max / high / low |
```

- `model: "grok4.7"` resolves to `xai/grok-4.7`; `model: "grok4.7", thinking: "high"` pins the effort.
- `model: "xai/grok-4.7"` bypasses the table.
- An unknown alias fails with the known list; the plugin never guesses a provider.
- The table is a **billing boundary**. Do not route an alias marked "xAI subscription" to a different provider.

## Topology

| Value | When | Behavior |
|---|---|---|
| `auto` | default | `HERDR_ENV=1` → split the caller's pane; otherwise dedicated workspace. |
| `workspace` | GUI | One workspace per repo (`DSH · repo`) + one tab per task. |
| `split` | DSH inside Herdr | Split the caller's pane; requires `HERDR_ENV` and `HERDR_PANE_ID`. |

The workspace map is persisted in `state.json`; closing the workspace by hand is fine — the next spawn recreates it once.

## Native subagent provider

The plugin registers a DSH subagent provider named by `subagentName`. To make
the native `subagent` tool route through Herdr, add a tool row (the default
`subagent` row keeps using the in-process `spawn` provider):

```yaml
- id: tool-subagent-herdr
  name: "@deepseek-ai/dsh-tool-subagent"
  config:
    provider: herdr
    toolName: herdr_subagent
```

That tool returns the child's final text through DSH's subagent service, so it
gets native cards, catalog entries, and cancellation. The provider advertises
no `agentOptions`, preset, structured-output, or depth capabilities; use
`herdr_spawn_agent` when you need the full review packet (diff, session,
artifacts).

## Transports

The CLI is the reference and default transport. `transport: auto` tries the local
socket for one call; if the connection fails, that process degrades to CLI for
the rest of the session. `socket` is for validating the protocol; it does not
fall back. The socket is local-only; remote machines always use `--machine` over
the CLI.

## Remote machines

Add an existing Herdr machine profile to `machines` to target it. For remote
spawn, give the plugin file access in one of two ways:

- `machineTargets: ["builder-01=me@builder.example.com"]` — the plugin reads and
  writes task files over SSH (`BatchMode=yes`, key auth required). No mount.
- `sharedFilesystem: ["builder-01"]` — the remote paths are already visible
  locally at the same absolute paths.

Without either, remote spawn is refused with a config error; `list`, `read`, and
`message` still work because they only need the Herdr API. Doctor checks the
machine reachability and the file-access mode.

## Concurrency

`maxParallelAgents` counts `starting`, `working`, `blocked`, and `running` records. A finished but unclosed agent does not consume a slot; its pane stays for inspection. Over the cap, a spawn waits up to `queueTimeoutMs` (default 5 min) and reports `timing.queuedMs`; it does not fail instantly. The queue is a poll over the shared registry, so it also sees agents spawned by another DSH process.

`isolated:true` runs the task in `<worktreesRoot>/<repo>-<taskId>` on branch `dsh/<taskId>`, based on `HEAD` of the requested repo. Uncommitted changes are **not** copied. Nothing is merged or removed automatically; review the diff, then `herdr_close_agent({remove_worktree:true})` if you want it gone.

## Paths and permissions

- `homeDir` must be writable by the DSH process.
- `allowCwd` entries are expanded (`~`) and compared with path boundaries, not string prefixes (`/repo-evil` is outside `/repo`).
- Artifacts never go into the project checkout.

## Disabling

```yaml
- id: tool-herdr
  name: dsh-herdr
  config:
    enabled: false
```

The tools stay registered (so a session does not lose its schema) but every spawn returns `SPAWN_REFUSED`. Running agents are untouched.

## Per-profile vs global

All keys are per profile. To share a config across profiles, use a YAML anchor or keep a snippet in your dotfiles and include it. There is no global config file; the plugin reads only the composed profile config.
