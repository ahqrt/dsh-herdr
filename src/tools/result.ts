// herdr_get_agent_result — pull (and optionally wait for) a delegated result.

import { join } from "node:path";
import { isActiveStatus } from "../domain/status.js";
import { ensureDir } from "../domain/paths.js";
import { HerdrError } from "../domain/errors.js";
import type { TaskRecord } from "../domain/types.js";
import { waitForSettle } from "../services/wait.js";
import { renderAgentResult, wrapExecute } from "./shared.js";
import type { ToolFactoryOptions } from "../host.js";

export function createResultTool({ defineTool, deps }: ToolFactoryOptions) {
  return defineTool({
    name: "herdr_get_agent_result",
    description:
      "Fetch the result of an agent started with herdr_spawn_agent, or observe any live Herdr agent by name/pane id. " +
      "wait=true blocks until the agent is idle/done/blocked (or the timeout expires). " +
      "The result is read from the child's pi session file (exact final assistant message), then result.md, then the pane tail; git diff since spawn is included when known. " +
      "Use it after a spawn returned status=running, or to re-read a settled agent. It never re-submits the task.",
    parameters: {
      target: {
        type: "string",
        required: true,
        description: "Task id, agent name, or pane id.",
      },
      machine: {
        type: "string",
        description:
          "Herdr --machine label for an external agent (owned tasks remember their machine).",
      },
      wait: {
        type: "boolean",
        description: "Block until settled (default: true when the task is still running).",
      },
      timeout_ms: {
        type: "number",
        description: "Wait budget in milliseconds (default 600000).",
      },
      lines: {
        type: "number",
        description: "Pane tail lines used as fallback (default 80).",
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
      render: (_args: unknown, value: Parameters<typeof renderAgentResult>[0]) =>
        renderAgentResult(value),
    },
    execute: wrapExecute(async (args: Record<string, unknown>, exec) => {
      const target = String(args.target ?? "");
      const machine = typeof args.machine === "string" ? args.machine : undefined;
      const record = await resolveRecord(target, machine, deps, exec.signal);
      if (!record) {
        throw new HerdrError("TASK_NOT_FOUND", `no agent or task matches "${target}"`, {
          remediation: "call herdr_list_agents to see the live names and pane ids",
        });
      }

      const shouldWait =
        args.wait === true || (args.wait !== false && isActiveStatus(record.status));
      const transport = deps.transports.resolve(record.machine);
      if (shouldWait) {
        const settled = await waitForSettle(
          transport,
          record.name ?? record.paneId ?? target,
          typeof args.timeout_ms === "number" ? args.timeout_ms : 600_000,
          exec.signal,
        );
        if (settled === "gone") record.status = "gone";
      }

      const result = await deps.harvest.harvest(record, {
        signal: exec.signal,
        tailLines: typeof args.lines === "number" ? args.lines : undefined,
        withDiff: !record.external,
      });

      if (!record.external) {
        await deps.store.update(record.taskId, {
          status: result.status,
          sessionPath: result.sessionPath,
          updatedAt: Date.now(),
          settledAt: result.status === "running" ? undefined : Date.now(),
        });
      }
      return result;
    }),
  });
}

async function resolveRecord(
  target: string,
  machine: string | undefined,
  deps: ToolFactoryOptions["deps"],
  signal?: AbortSignal,
): Promise<TaskRecord | undefined> {
  const known = await deps.store.find(target);
  if (known) return known;

  const transport = deps.transports.resolve(machine);
  const live = await transport.getAgent(target, signal);
  if (!live || (!live.paneId && !live.name)) return undefined;

  const safe = String(live.name ?? live.paneId ?? target)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(0, 64);
  const artifactDir = ensureDir(join(deps.paths.artifactsRoot, "external", safe));
  return {
    schemaVersion: 1,
    taskId: `external-${safe}`,
    name: live.name ?? target,
    kind: live.kind ?? "unknown",
    cwd: live.cwd ?? process.cwd(),
    artifactDir,
    role: "worker",
    status: live.status === "blocked" ? "blocked" : live.status === "working" ? "running" : "idle",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    paneId: live.paneId,
    tabId: live.tabId,
    workspaceId: live.workspaceId,
    sessionPath: live.sessionPath,
    machine,
    external: true,
  };
}
