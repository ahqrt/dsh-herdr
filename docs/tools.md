# Tools

Seven tools, one protocol. Names are stable; breaking a parameter or a result field is a semver-major change.

| Tool | One line |
|---|---|
| [`herdr_spawn_agent`](#herdr_spawn_agent) | Delegate a task to a Herdr agent. |
| [`herdr_get_agent_result`](#herdr_get_agent_result) | Harvest a result, optionally wait. |
| [`herdr_message_agent`](#herdr_message_agent) | Send a follow-up, findings, or an answer. |
| [`herdr_list_agents`](#herdr_list_agents) | Fleet view. |
| [`herdr_interrupt_agent`](#herdr_interrupt_agent) | Cancel the current turn. |
| [`herdr_close_agent`](#herdr_close_agent) | Close an owned pane. |
| [`herdr_doctor`](#herdr_doctor) | Environment self-check. |

All tools return the same `AgentResult` shape where applicable — see [result-contract.md](result-contract.md).

---

## `herdr_spawn_agent`

Starts a pane, starts an agent, submits a task envelope, waits for a settled state, and returns the review packet.

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `prompt` | string, **required** | — | Self-contained: goal, constraints, acceptance criteria, tests. |
| `kind` | string | `pi` | `pi`, `agy`, `claude`, `codex`, … (live kind list from Herdr). |
| `model` | string | `flash` (for pi) | Alias from `model-aliases.md` or `provider/model`. |
| `thinking` | string | agent default | `low` / `medium` / `high` / `xhigh` / `max`. |
| `name` | string | generated | Must match `[a-z][a-z0-9_-]{0,31}`. |
| `cwd` | string | session cwd | Must be inside `allowCwd` when configured. |
| `role` | `worker` \| `reviewer` | `worker` | `reviewer` gets a read-only envelope. |
| `wait` | boolean | `true` | `false` returns a live handle immediately. |
| `timeout_ms` | number | `900000` | Clamped to `10s..1h`. A timeout returns `running`. |
| `agent_args` | string[] | — | Raw flags after `--`, for kinds without first-class support. |
| `client_task_id` | string | — | Idempotency key; a repeat returns the existing task. |

**Behavior**

1. Gates: `enabled`, cwd exists and is allowed, concurrency cap.
2. Resolves the model alias and validates the kind's capabilities (agy refuses `--model`).
3. Creates the task record **before** the pane, so a crash leaves an inspectable record.
4. Topology: dedicated workspace + one tab per task (GUI), or a sibling split (inside Herdr).
5. `agent start` → boot poll → `agent prompt --wait --until idle/done/blocked`.
6. Harvest and return.

**Returns** an `AgentResult` with `status` in `completed | blocked | running | failed | gone`.

**Never** answers a blocked agent. If `status=blocked`, ask the user, then call `herdr_message_agent`.

---

## `herdr_get_agent_result`

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `target` | string, **required** | — | Task id, agent name, or pane id. |
| `wait` | boolean | `true` when the task is running | Blocks until idle/done/blocked. |
| `timeout_ms` | number | `600000` | Wait budget. |
| `lines` | number | `80` | Pane tail fallback. |

For a target the plugin did not spawn, it returns an **observation** (`status=idle`, `nextAction=none`) with the last assistant message as context. It never re-submits the task.

---

## `herdr_message_agent`

| Parameter | Type | Default | Notes |
|---|---|---|---|
| `target` | string, **required** | — | Name, pane, or task id. |
| `message` | string, **required** | — | The text. |
| `kind` | `NOTE` \| `REVIEW_FINDINGS` \| `ACCEPT` \| `REJECT` \| `ANSWER` | — | Protocol header. |
| `round` | number | `1` | Used by `REVIEW_FINDINGS`. |
| `wait` | boolean | `false` | Wait for the target's turn to settle. |
| `timeout_ms` | number | `600000` | Wait budget. |

The message is wrapped in `<agent-message from="dsh:orchestrator" to="…">`. When the target is blocked, Herdr delivers the text as the answer to its question.

`REVIEW_FINDINGS` expands to a standard prologue (fix BLOCKER/MAJOR, address MINOR/NIT, re-run tests, reply COMPLETE) around your findings.

---

## `herdr_list_agents`

| Parameter | Type | Default |
|---|---|---|
| `owned_only` | boolean | `false` |

Returns `{ agents: FleetRow[] }`. `owned` marks a task in this plugin's registry. Foreign agents are included read-only.

---

## `herdr_interrupt_agent`

Sends Escape to the agent's pane. The pane, session file, and record remain; the record becomes `interrupted`. Use `herdr_message_agent` for a stop-and-redirect.

## `herdr_close_agent`

| Parameter | Type | Default |
|---|---|---|
| `target` | string, **required** | — |
| `force` | boolean | `false` |

Refuses unowned panes, and refuses a working agent unless `force:true`. The pi session file survives; the transcript is not lost.

## `herdr_doctor`

No parameters. Returns `{ ok, checks[], next[], aliases[], runtime }`. Each check is `ok | warn | fail` with a human detail and, when known, a fix in `next`.

---

## Protocol headers

Agent-to-DSH and DSH-to-agent messages use a small vocabulary so a review loop is legible in the transcript:

| Header | Direction | Meaning |
|---|---|---|
| `COMPLETE <path>` | child → DSH | Task done; `result.md` is at `path`. |
| `BLOCKED` | child → DSH | Needs a decision. |
| `REVIEW_REQUEST` | child → DSH | Wants a review before continuing. |
| `REVIEW_FINDINGS round N` | DSH → child | Fix these findings. |
| `ACCEPT` / `REJECT` | either | Close the loop. |
| `NOTE` | either | Free-form. |

The child is asked to append one JSON line per message to `<artifactDir>/inbox.ndjson`; `herdr_inbox` (a future tool) will consume it. Today the synchronous tool result is the primary channel.

---

## Tool output and truncation

- `finalMessage` and `resultText` are truncated at `maxResultChars` (default 40,000); the full `result.md` path is always included.
- `diff.patch` is truncated at `maxDiffBytes` (default 512 KiB); `diff.truncated` says so.
- The model-facing rendering includes the header, evidence, and the final message. The raw `AgentResult` is the tool's value; the contract is in [result-contract.md](result-contract.md).
