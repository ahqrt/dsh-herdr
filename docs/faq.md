# FAQ

**When should DSH use `herdr_spawn_agent` instead of its own subagent?**

When at least one of these is true: the user named a Herdr/pi pane, the task needs a different model family for an independent review, the work needs a real terminal the user can take over, or the task must reuse an existing Herdr pane. Otherwise use DSH's in-process subagent — it is faster and shares context.

**Why not just run `pi -p` in a shell?**

`pi -p` is one-shot and invisible. Herdr gives you a live pane, state detection, blocked/approval handling, and a session file you can resume. The plugin also gets `agent list/get/read`, which a bare subprocess does not provide.

**Why does the plugin keep panes open?**

The pane is the audit trail. You can watch the turn, answer a question, or take over with your own keystrokes. Close it when you are done.

**Does DSH become addressable as a Herdr agent?**

No. DSH is not a pane, so `herdr agent prompt` cannot target it. Inbound messages go through the task's `inbox.ndjson` and a future `herdr_inbox`; today the synchronous tool result is the primary channel.

**Can two agents message each other without DSH?**

Yes. They are ordinary Herdr agents: `herdr agent prompt <other> …` works, and the `herdr_message_agent` protocol headers are just text. DSH is not a broker.

**Why is `model` pi-only?**

`pi` has a stable `--model`/`--thinking` contract; `agy` explicitly refuses them; other kinds use different flags (`codex -m`, `claude --model`, …). The plugin passes `agent_args` through rather than guessing. Adding a kind is a small, tested change to `src/domain/launch.ts`.

**What happens when the task takes longer than `timeout_ms`?**

The tool returns `status=running` and leaves the agent alive. Call `herdr_get_agent_result(wait:true)` to continue waiting. Do not re-submit the prompt; that starts a second turn.

**What happens if DSH restarts mid-task?**

`state.json` retains the record; the pane and pi session live in Herdr. `herdr_get_agent_result` can harvest it after restart. If the pane was closed, the session file is still readable via the path in the record.

**Can I use it on Windows?**

The TypeScript and unit tests run on Windows. The fake-herdr integration test is skipped there. Real usage needs Herdr's Windows build and a `pi` on `PATH`; it is not part of the tested matrix yet.

**Can I use it with a remote Herdr (`--machine`)?**

Not in 0.1.x. The transport is local-only. A remote adapter is a port implementation, not a rewrite; see [ROADMAP.md](../ROADMAP.md).

**Does it spend money?**

Only by running the models you asked for. The plugin adds no LLM calls of its own. The alias table is where billing boundaries live; `herdr_doctor` shows the resolved default model.

**How do I review a diff without spawning a new model?**

Just read the `diff` and `finalMessage` returned by the worker in DSH. `role=reviewer` and a second model are optional, for independent review.

**Why is the result truncated?**

Tool results enter the model context. `maxResultChars` and `maxDiffBytes` bound that cost; the full files stay on disk and their paths are in the result. Raise the limits if you need more in-context evidence.

**How do I clean up everything?**

Close the panes (`herdr_close_agent` or the Herdr UI), then delete `~/.dsh/herdr/`. Uninstalling the plugin does not delete state or panes.
