// herdr_spawn_agent — delegate one subtask to a Herdr-managed agent.

import { resolveCwd, renderAgentResult, wrapExecute } from "./shared.js";
import type { ToolFactoryOptions } from "../host.js";

export function createSpawnTool({ defineTool, deps }: ToolFactoryOptions) {
  return defineTool({
    name: "herdr_spawn_agent",
    description:
      "Delegate a self-contained subtask to a coding agent running in a Herdr pane (pi, agy, claude, codex, …), wait for it, and return the exact final message plus git diff evidence. " +
      "Use ONLY when the user explicitly asks for Herdr/pi/a pane/model alias (grok4.7, gpt6sol, opus5, flash, …), or explicitly wants an independent reviewer. Do not delegate ordinary work you can do yourself, and do not add a second model 'for safety'. " +
      "`model` accepts a short alias from ~/.pi/agent/model-aliases.md or a provider/model id; `thinking` accepts low/medium/high/xhigh/max. Only kind=pi accepts model/thinking; agy refuses them. " +
      "The child runs with the user's permissions in `cwd`. role=reviewer means read-only review: findings are `[severity] path:line — issue — why — evidence`. " +
      "If status is blocked, ask the user and answer with herdr_message_agent — never answer a blocked agent yourself. If status is running, call herdr_get_agent_result(wait:true); do not re-submit the task.",
    parameters: {
      prompt: {
        type: "string",
        required: true,
        description:
          "The complete task for the child. Self-contained: goal, constraints, acceptance criteria, what to test.",
      },
      name: {
        type: "string",
        description: "Optional agent name ([a-z][a-z0-9_-]{0,31}). Auto-generated when omitted.",
      },
      kind: {
        type: "string",
        description: "Herdr agent kind: pi (default), agy, claude, codex, gemini, grok, …",
      },
      model: {
        type: "string",
        description: "Model alias (grok4.7, gpt6sol, opus5, flash) or provider/model id. pi only.",
      },
      thinking: {
        type: "string",
        description:
          "Reasoning effort: low | medium | high | xhigh | max. pi only. Omit to use the agent's default.",
      },
      cwd: {
        type: "string",
        description: "Working directory for the child. Defaults to this DSH session's working directory.",
      },
      role: {
        type: "string",
        enum: ["worker", "reviewer"],
        description: "worker (default) implements; reviewer is read-only review.",
      },
      wait: {
        type: "boolean",
        description: "Wait for completion (default true). false returns a live handle immediately.",
      },
      timeout_ms: {
        type: "number",
        description:
          "Deadline in milliseconds (default 900000, max 3600000). A timeout returns status=running, not a failure.",
      },
      agent_args: {
        type: "array",
        items: { type: "string" },
        description: "Raw CLI flags appended after `--` for the kind's own launch (escape hatch).",
      },
      client_task_id: {
        type: "string",
        description:
          "Optional idempotency key. A repeated call with the same key returns the existing task instead of spawning again.",
      },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: true,
        properties: {
          taskId: { type: "string" },
          status: { type: "string" },
          summary: { type: "string" },
        },
      },
      render: (_args: unknown, value: Parameters<typeof renderAgentResult>[0]) => renderAgentResult(value),
    },
    execute: wrapExecute(async (args: Record<string, unknown>, exec) => {
      const cwd = await resolveCwd({
        ctx: deps.ctx,
        exec,
        explicit: typeof args.cwd === "string" ? args.cwd : undefined,
      });
      return deps.spawn.spawn({
        prompt: String(args.prompt ?? ""),
        cwd,
        kind: typeof args.kind === "string" ? args.kind : undefined,
        model: typeof args.model === "string" ? args.model : undefined,
        thinking: typeof args.thinking === "string" ? args.thinking : undefined,
        name: typeof args.name === "string" ? args.name : undefined,
        role: args.role === "reviewer" ? "reviewer" : "worker",
        wait: args.wait !== false,
        timeoutMs: typeof args.timeout_ms === "number" ? args.timeout_ms : undefined,
        agentArgs: Array.isArray(args.agent_args)
          ? args.agent_args.filter((value): value is string => typeof value === "string")
          : undefined,
        clientTaskId: typeof args.client_task_id === "string" ? args.client_task_id : undefined,
        sessionId: exec.agent?.session?.id,
        signal: exec.signal,
      });
    }),
    presentCall: (args: Record<string, unknown>) => ({
      card: "generic",
      title: `Delegate to Herdr${args.model ? ` · ${String(args.model)}` : ""}`,
      kind: "other",
      rawInput: {
        prompt: args.prompt,
        model: args.model,
        kind: args.kind,
        cwd: args.cwd,
      },
    }),
  });
}
