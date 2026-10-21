# Troubleshooting

Start with `herdr_doctor`. Its `FAIL` lines name the fix. Everything below assumes the doctor output.

## Error codes

| Code | Meaning | Fix |
|---|---|---|
| `HERDR_UNAVAILABLE` | Binary missing or not executable | Install herdr or set `herdrBin` / `HERDR_BIN`; check `herdr --version`. |
| `HERDR_TOO_OLD` | Client below `0.9.0`, or version unparseable | Upgrade herdr; reopen the pane. |
| `HERDR_PROTOCOL` | Non-JSON output or a malformed envelope | Run the same command in a terminal; check for shell noise in `herdr` output. |
| `AGENT_NOT_FOUND` | Name/pane no longer exists | `herdr_list_agents`; the session file may still be readable via a retained record. |
| `PANE_GONE` | Pane closed under us | Re-`spawn` or `herdr_resume` (future); inspect `~/.dsh/herdr/tasks/<id>/`. |
| `AGENT_BLOCKED` | Target is waiting at an approval/question | Ask the user, then `herdr_message_agent`. |
| `AGENT_STALLED` | Prompt was written but no turn started (after one retry) | Inspect the pane; the text may have been lost. Do not blind-resend. |
| `SPAWN_REFUSED` | `enabled:false`, boot failure, or start rejection | Read the message; fix config or inspect the new tab. |
| `CONCURRENCY_LIMIT` | `maxParallelAgents` reached and the queue wait expired | Close a finished agent, raise `queueTimeoutMs`, or raise the cap. |
| `CWD_NOT_ALLOWED` | `cwd` outside `allowCwd` | Add the directory deliberately. |
| `TASK_NOT_FOUND` | Handle matches no record and no live agent | `herdr_list_agents`. |
| `TASK_NOT_OWNED` | Refused to mutate a pane the plugin did not create | Use the Herdr UI, or spawn through the plugin. |
| `NO_TRANSCRIPT` | The kind has no pi session file | Only kind=pi has a transcript; use `herdr_get_agent_result` for pane text. |
| `VALIDATION_ERROR` | Bad argument, unsupported flag, unresolved alias | Read the `fix:` line; aliases come from `model-aliases.md`. |
| `TIMEOUT` | CLI call or wait budget expired | A timed-out delegation is still alive; call `herdr_get_agent_result(wait:true)`. |
| `ABORTED` | The tool call was cancelled | The plugin sends Escape to an owned agent; check its status. |
| `STORE_UNAVAILABLE` | State lock/permission problem | Check `~/.dsh/herdr` ownership; remove a stale `.lock` if no DSH is running. |
| `HERDR_UNAVAILABLE` with `phase: connect` | `transport: socket` could not reach the local socket | Open Herdr once, or use `transport: auto`/`cli`. With `auto` the plugin degrades silently. |

## Symptom: tools are not listed

1. Is the bundle in `dsh.profile.bundles`? (`~/.dsh/profiles/<name>/package.json`)
2. Is the patch row composed? `dsh --profile <name> --dump-config | grep -A2 tool-herdr`.
3. Desktop: restart the app once. HMR can fail to pick up a new package from a fresh `file:` install.
4. Check the app log for `tool-herdr` or `dsh-herdr` activation errors.

## Symptom: spawn succeeds, `status=running` forever

- `herdr_get_agent_result(wait:true)` again with a larger `timeout_ms`.
- Look at the pane: is the child waiting for an approval? Then the status should be `blocked`; if Herdr missed it, `agent read` shows the dialog.
- If the provider hit a rate limit, the pi session's last message has `stopReason: error`; harvest returns `failed` with the message.
- A pane that is visibly idle but reports `working` is a Herdr state-detection miss. `herdr pane report-agent <pane> --source manual --agent pi --state idle` unsticks it.

## Symptom: empty or stale final message

- Harvest ignores a session message older than `promptedAt`. `warnings` says so. The child may not have started a turn — check the pane.
- `result.md` is the second source; if it is empty too, the result carries a pane tail.
- For `agy` and other non-pi kinds there is no session file; pane tail is expected.

## Symptom: `diff` is empty

- `cwd` is not a git repo → no diff by design.
- The child changed nothing.
- The repo was dirty before the spawn; `dirtyAtStart` lists those files. The patch still includes them, so subtract them when reviewing.

## Symptom: alias not found

```bash
pi --list-models grok
```

Use the exact `provider/model` from the output, or add a row to `~/.pi/agent/model-aliases.md`. The plugin deliberately does not fuzzy-match.

## Symptom: agy refuses model

`kind=agy` rejects `model` and `thinking` (its CLI does). Omit them; pass agy's own flags through `agent_args`.

## Symptom: socket transport behaves differently from the CLI

`transport: auto` degrades to CLI only on a **connect** failure. An I/O failure
mid-request surfaces as `HERDR_UNAVAILABLE` instead of retrying, because retrying
a mutation could apply it twice. Switch to `transport: cli` to confirm whether
the socket is the problem, and run `herdr status` for protocol drift.

## Symptom: a remote machine is refused

- `machine "x" is not enabled` → add the label to `machines`.
- `not declared as sharing a filesystem` → remote spawn needs a mounted
  filesystem for artifacts and the pi session; add it to `sharedFilesystem`, or
  use remote `list`/`read`/`message` only.
- `herdr --machine <label> status` should answer; doctor checks each configured
  machine.

## Symptom: worktree creation fails

- `cwd` is not a git repo, or the repo has no commit (`HEAD` missing).
- The branch `dsh/<taskId>` already exists (rare; task ids are unique).
- An uncommitted checkout is fine, but its changes are **not** copied into the worktree — commit first if you need them there.

## Symptom: inbox is always empty

The child only writes messages if the envelope is followed. Check `<taskDir>/inbox.ndjson` and the `warnings` in the result. A child that finishes without reporting still has a valid final message; the inbox is an additional channel, not the only one.

## Symptom: panes pile up

Finished agents keep their panes by design. Close them with `herdr_close_agent`. Closing a tab in Herdr also works; the record becomes `gone` on the next harvest.

## Logs and state

| File | Contents |
|---|---|
| `~/.dsh/herdr/state.json` | Task registry + workspace map (schemaVersion 1). |
| `~/.dsh/herdr/audit.ndjson` | Spawn/message/close events with timestamps. |
| `~/.dsh/herdr/tasks/<taskId>/prompt.md` | The exact envelope. |
| `~/.dsh/herdr/tasks/<taskId>/result.md` | The child's report. |
| `~/.dsh/herdr/tasks/<taskId>/diff.patch` | Baseline diff (bounded). |

A corrupt `state.json` is renamed to `state.json.corrupt-<ts>` and the registry restarts empty. Panes still exist in Herdr; the plugin will treat them as foreign until re-spawned.

## Getting help

Open a [bug report](https://github.com/ahqrt/dsh-herdr/issues/new?template=bug_report.yml) with:

- `herdr --version`, DSH version, OS;
- `herdr_doctor` output (redact paths if needed);
- the task id and the `audit.ndjson` lines around it;
- whether the pane still exists.
