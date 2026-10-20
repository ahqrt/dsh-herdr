// Fleet lifecycle: close, interrupt, and the combined Herdr + registry view.
import { HerdrError } from "../domain/errors.js";
export class LifecycleService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async close(input) {
        const { transport, store, audit } = this.deps;
        const record = await store.find(input.target);
        if (!record) {
            throw new HerdrError("TASK_NOT_OWNED", `refusing to close "${input.target}": this plugin did not spawn it`, { remediation: "close user-owned panes in the Herdr UI" });
        }
        if (!record.paneId) {
            throw new HerdrError("TASK_NOT_FOUND", `task ${record.taskId} has no pane`, {
                remediation: "the task may have failed before a pane was created",
            });
        }
        const agent = await transport.getAgent(record.name, input.signal).catch(() => undefined);
        if (agent && agent.paneId && agent.paneId !== record.paneId) {
            throw new HerdrError("TASK_NOT_OWNED", `pane ${record.paneId} now hosts a different agent; refusing to close it`, { remediation: "close the pane in the Herdr UI after checking what runs there" });
        }
        const active = record.status === "working" ||
            record.status === "starting" ||
            record.status === "blocked" ||
            record.status === "running";
        if (active && input.force !== true) {
            throw new HerdrError("VALIDATION_ERROR", `agent ${record.name} is ${record.status}; wait, interrupt it, or pass force:true`, { remediation: "herdr_interrupt_agent cancels the current turn without closing the pane" });
        }
        if (input.removeWorktree && record.worktree) {
            await this.deps.worktree.remove(record.worktree, input.force === true);
        }
        await transport.closePane(record.paneId, input.signal);
        await store.update(record.taskId, {
            status: "closed",
            closedAt: Date.now(),
            updatedAt: Date.now(),
            ...(input.removeWorktree && record.worktree ? { worktree: undefined } : {}),
        });
        audit.write({
            event: "close",
            taskId: record.taskId,
            paneId: record.paneId,
            forced: input.force === true,
        });
        return {
            closed: true,
            paneId: record.paneId,
            message: `closed ${record.name} (pane ${record.paneId}); the session file is retained${record.sessionPath ? ` at ${record.sessionPath}` : ""}`,
        };
    }
    async interrupt(target, signal) {
        const { transport, store, audit } = this.deps;
        const record = await store.find(target);
        if (!record) {
            throw new HerdrError("TASK_NOT_OWNED", `refusing to interrupt "${target}": not spawned by this plugin`, {
                remediation: "use the Herdr UI for panes you opened yourself",
            });
        }
        if (!record.name) {
            throw new HerdrError("TASK_NOT_FOUND", `task ${record.taskId} has no agent name`);
        }
        await transport.sendKeys(record.name, ["esc"], signal);
        await store.update(record.taskId, { status: "interrupted", updatedAt: Date.now() });
        audit.write({ event: "interrupt", taskId: record.taskId, name: record.name });
        return {
            interrupted: true,
            message: `sent Escape to ${record.name}; the provider turn is interrupted, the pane and session stay`,
        };
    }
    /** Owned records joined with the live Herdr fleet. */
    async list(options = {}) {
        const { transport, store } = this.deps;
        const [records, live] = await Promise.all([
            store.list(),
            transport.listAgents(options.signal).catch(() => []),
        ]);
        const byName = new Map(live.filter((agent) => agent.name).map((agent) => [agent.name, agent]));
        const byPane = new Map(live.filter((agent) => agent.paneId).map((agent) => [agent.paneId, agent]));
        const rows = [];
        const claimed = new Set();
        for (const record of records) {
            if (record.status === "closed")
                continue;
            const agent = byName.get(record.name) ?? byPane.get(record.paneId ?? "");
            if (agent?.paneId)
                claimed.add(agent.paneId);
            if (record.paneId)
                claimed.add(record.paneId);
            rows.push({
                owned: true,
                taskId: record.taskId,
                name: record.name,
                kind: record.kind,
                model: record.model,
                status: record.status,
                herdrStatus: agent?.status,
                cwd: agent?.cwd ?? record.cwd,
                paneId: agent?.paneId ?? record.paneId,
                tabId: agent?.tabId ?? record.tabId,
                role: record.role,
                ageMs: Date.now() - record.createdAt,
            });
        }
        if (!options.ownedOnly) {
            for (const agent of live) {
                if (agent.paneId && claimed.has(agent.paneId))
                    continue;
                rows.push({
                    owned: false,
                    name: agent.name,
                    kind: agent.kind,
                    status: agent.status,
                    herdrStatus: agent.status,
                    cwd: agent.cwd,
                    paneId: agent.paneId,
                    tabId: agent.tabId,
                });
            }
        }
        return rows;
    }
}
//# sourceMappingURL=lifecycle.js.map