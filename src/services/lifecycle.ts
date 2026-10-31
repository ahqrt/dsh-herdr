// Fleet lifecycle: close, interrupt, and the combined Herdr + registry view.

import { HerdrError } from "../domain/errors.js";
import type { AgentInfo, TaskRecord } from "../domain/types.js";
import type { AuditLog, TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
import type { WorktreeService } from "./worktree.js";

export interface LifecycleDeps {
  transports: TransportPool;
  store: TaskStore;
  audit: AuditLog;
  worktree: WorktreeService;
}

export interface CloseInput {
  target: string;
  force?: boolean;
  removeWorktree?: boolean;
  signal?: AbortSignal;
}

export interface CloseResult {
  closed: boolean;
  paneId?: string;
  message: string;
}

export class LifecycleService {
  constructor(private readonly deps: LifecycleDeps) {}

  async close(input: CloseInput): Promise<CloseResult> {
    const { store, audit } = this.deps;
    const record = await store.find(input.target);
    if (!record) {
      throw new HerdrError(
        "TASK_NOT_OWNED",
        `refusing to close "${input.target}": this plugin did not spawn it`,
        { remediation: "close user-owned panes in the Herdr UI" },
      );
    }
    const transport = this.deps.transports.resolve(record.machine);
    if (!record.paneId) {
      throw new HerdrError("TASK_NOT_FOUND", `task ${record.taskId} has no pane`, {
        remediation: "the task may have failed before a pane was created",
      });
    }

    const agent = await transport.getAgent(record.name, input.signal).catch(() => undefined);
    if (agent && agent.paneId && agent.paneId !== record.paneId) {
      throw new HerdrError(
        "TASK_NOT_OWNED",
        `pane ${record.paneId} now hosts a different agent; refusing to close it`,
        { remediation: "close the pane in the Herdr UI after checking what runs there" },
      );
    }
    // Keep the transcript readable after the pane is gone: a task that never
    // settled otherwise loses the only pointer to its pi session.
    if (!record.sessionPath && agent?.sessionPath) {
      record.sessionPath = agent.sessionPath;
      await store.update(record.taskId, {
        sessionPath: agent.sessionPath,
        updatedAt: Date.now(),
      });
    }

    const active =
      record.status === "working" ||
      record.status === "starting" ||
      record.status === "blocked" ||
      record.status === "running";
    if (active && input.force !== true) {
      throw new HerdrError(
        "VALIDATION_ERROR",
        `agent ${record.name} is ${record.status}; wait, interrupt it, or pass force:true`,
        { remediation: "herdr_interrupt_agent cancels the current turn without closing the pane" },
      );
    }

    if (input.removeWorktree && record.worktree) {
      await this.deps.worktree.remove(record.worktree, input.force === true, record.machine);
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

  async interrupt(
    target: string,
    signal?: AbortSignal,
  ): Promise<{ interrupted: boolean; message: string }> {
    const { store, audit } = this.deps;
    const record = await store.find(target);
    if (!record) {
      throw new HerdrError(
        "TASK_NOT_OWNED",
        `refusing to interrupt "${target}": not spawned by this plugin`,
        {
          remediation: "use the Herdr UI for panes you opened yourself",
        },
      );
    }
    if (!record.name) {
      throw new HerdrError("TASK_NOT_FOUND", `task ${record.taskId} has no agent name`);
    }
    const transport = this.deps.transports.resolve(record.machine);
    await transport.sendKeys(record.name, ["esc"], signal);
    await store.update(record.taskId, { status: "interrupted", updatedAt: Date.now() });
    audit.write({ event: "interrupt", taskId: record.taskId, name: record.name });
    return {
      interrupted: true,
      message: `sent Escape to ${record.name}; the provider turn is interrupted, the pane and session stay`,
    };
  }

  /** Owned records joined with the live Herdr fleet. */
  async list(
    options: { ownedOnly?: boolean; machine?: string; signal?: AbortSignal } = {},
  ): Promise<FleetRow[]> {
    const { store } = this.deps;
    const machine = options.machine;
    const transport = this.deps.transports.resolve(machine);
    const [allRecords, live] = await Promise.all([
      store.list(),
      transport.listAgents(options.signal).catch(() => [] as AgentInfo[]),
    ]);
    const scope = machine ?? "local";
    const records = allRecords.filter((task) => (task.machine ?? "local") === scope);
    const byName = new Map(live.filter((agent) => agent.name).map((agent) => [agent.name!, agent]));
    const byPane = new Map(
      live.filter((agent) => agent.paneId).map((agent) => [agent.paneId!, agent]),
    );
    const rows: FleetRow[] = [];
    const claimed = new Set<string>();
    const recovered = new Map<string, TaskRecord>();

    // A spawn call that never returned (caller aborted, window closed) leaves
    // the record at "working" with no session path. Herdr already reports the
    // pane as done, so fold that settle back into the registry instead of
    // showing a finished task as still running.
    for (const record of records) {
      if (record.status !== "starting" && record.status !== "working") continue;
      if (!record.promptedAt) continue;
      const agent = byName.get(record.name) ?? byPane.get(record.paneId ?? "");
      if (!agent || agent.status !== "done") continue;
      const patch: Partial<TaskRecord> = {
        status: "completed",
        settledAt: record.settledAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      if (!record.sessionPath && agent.sessionPath) patch.sessionPath = agent.sessionPath;
      const updated = await store.update(record.taskId, patch);
      if (!updated) continue;
      recovered.set(record.taskId, updated);
      this.deps.audit.write({
        event: "settle-recovered",
        taskId: record.taskId,
        paneId: agent.paneId,
        sessionPath: updated.sessionPath,
      });
    }

    for (const original of records) {
      const record = recovered.get(original.taskId) ?? original;
      if (record.status === "closed") continue;
      const agent = byName.get(record.name) ?? byPane.get(record.paneId ?? "");
      if (agent?.paneId) claimed.add(agent.paneId);
      if (record.paneId) claimed.add(record.paneId);
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
        machine: record.machine,
        ageMs: Date.now() - record.createdAt,
      });
    }

    if (!options.ownedOnly) {
      for (const agent of live) {
        if (agent.paneId && claimed.has(agent.paneId)) continue;
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

export interface FleetRow {
  owned: boolean;
  taskId?: string;
  name?: string;
  kind?: string;
  model?: string;
  status?: string;
  herdrStatus?: string;
  cwd?: string;
  paneId?: string;
  tabId?: string;
  role?: TaskRecord["role"];
  machine?: string;
  ageMs?: number;
}
