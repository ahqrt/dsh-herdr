# Configuration

The plugin is configured through the DSH profile's `cordis.patch.yml`. Defaults are safe; override only what you need. The schema lives in [`src/config.ts`](../src/config.ts), and the pure merge (with clamping) in [`src/defaults.ts`](../src/defaults.ts).

## Example

```yaml
- id: tool-herdr
  name: dsh-herdr
  config:
    enabled: true
    defaultKind: pi
    defaultModel: flash
    maxParallelAgents: 3
    defaultTimeoutMs: 900000

    # keep delegations inside these directories (empty = no restriction)
    allowCwd:
      - ~/Desktop
      - ~/code

    # auto: split when DSH runs inside Herdr, otherwise a dedicated workspace
    topology: auto
    workspaceLabel: "DSH · {repo}"

```

## Keys

| Key | Type | Default | Effect |
|---|---|---|---|
| `enabled` | boolean | `true` | `false` refuses every spawn. Does not kill running agents. |
| `herdrBin` | string | `herdr` | Path to the Herdr CLI. `HERDR_BIN` is the environment fallback. |
| `defaultKind` | string | `pi` | Kind used when `kind` is omitted. |
| `defaultModel` | string | `flash` | Alias/ID used for `kind=pi` when `model` is omitted. Empty = pi's own default. |
| `aliasesFile` | string | `~/.pi/agent/model-aliases.md` | The markdown alias table. Missing file = only raw IDs resolve. |
| `maxParallelAgents` | number | `3` | Concurrency cap; new spawns fail with `CONCURRENCY_LIMIT`. |
| `defaultTimeoutMs` | number | `900000` | Default wait budget (10s–1h). |
| `startTimeoutMs` | number | `60000` | Agent boot budget (5s–5min). |
| `maxResultChars` | number | `40000` | Truncation for `finalMessage` / `resultText`. |
| `maxDiffBytes` | number | `524288` | Truncation for `diff.patch`. |
| `topology` | `auto` \| `workspace` \| `split` | `auto` | Where panes are created. |
| `splitDirection` | `right` \| `down` | `right` | Used only by `split` topology. |
| `workspaceLabel` | string | `DSH · {repo}` | Template; `{repo}` is the cwd basename. |
| `homeDir` | string | `~/.dsh/herdr` | Root for state, audit, and artifacts. |
| `artifactsRoot` | string | `tasks` | Relative to `homeDir`, or absolute / `~`. |
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

## Concurrency

`maxParallelAgents` counts `starting`, `working`, `blocked`, and `running` records. A finished but unclosed agent does not consume a slot; its pane stays for inspection. Raise the cap only if your machine and provider rate limits can take it.

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
