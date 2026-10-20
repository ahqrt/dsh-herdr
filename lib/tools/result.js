// herdr_get_agent_result — pull (and optionally wait for) a delegated result.
import { join } from "node:path";
import { isActiveStatus } from "../domain/status.js";
import { ensureDir } from "../domain/paths.js";
import { HerdrError } from "../domain/errors.js";
import { waitForSettle } from "../services/wait.js";
import { renderAgentResult, wrapExecute } from "./shared.js";
export function createResultTool({ defineTool, deps }) {
    return defineTool({
        name: "herdr_get_agent_result",
        description: "Fetch the result of an agent started with herdr_spawn_agent, or observe any live Herdr agent by name/pane id. " +
            "wait=true blocks until the agent is idle/done/blocked (or the timeout expires). " +
            "The result is read from the child's pi session file (exact final assistant message), then result.md, then the pane tail; git diff since spawn is included when known. " +
            "Use it after a spawn returned status=running, or to re-read a settled agent. It never re-submits the task.",
        parameters: {
            target: {
                type: "string",
                required: true,
                description: "Task id, agent name, or pane id.",
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
            render: (_args, value) => renderAgentResult(value),
        },
        execute: wrapExecute(async (args, exec) => {
            const target = String(args.target ?? "");
            const record = await resolveRecord(target, deps, exec.signal);
            if (!record) {
                throw new HerdrError("TASK_NOT_FOUND", `no agent or task matches "${target}"`, {
                    remediation: "call herdr_list_agents to see the live names and pane ids",
                });
            }
            const shouldWait = args.wait === true || (args.wait !== false && isActiveStatus(record.status));
            if (shouldWait) {
                const settled = await waitForSettle(deps.transport, record.name ?? record.paneId ?? target, typeof args.timeout_ms === "number" ? args.timeout_ms : 600_000, exec.signal);
                if (settled === "gone")
                    record.status = "gone";
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
async function resolveRecord(target, deps, signal) {
    const known = await deps.store.find(target);
    if (known)
        return known;
    const live = await deps.transport.getAgent(target, signal);
    if (!live || (!live.paneId && !live.name))
        return undefined;
    const safe = String(live.name ?? live.paneId ?? target).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64);
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
        external: true,
    };
}
//# sourceMappingURL=result.js.map