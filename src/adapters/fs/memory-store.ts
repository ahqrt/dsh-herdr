// In-memory TaskStore for unit tests and embedders. Mirrors FileTaskStore's
// contract exactly, including activeCount semantics.

import { isActiveStatus } from "../../domain/status.js";
import type { TaskRecord, WorkspaceRecord } from "../../domain/types.js";
import type { TaskStore } from "../../ports/store.js";

export class MemoryTaskStore implements TaskStore {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly workspaces = new Map<string, WorkspaceRecord>();

  async put(record: TaskRecord): Promise<TaskRecord> {
    this.tasks.set(record.taskId, record);
    return record;
  }

  async update(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord | undefined> {
    const current = this.tasks.get(taskId);
    if (!current) return undefined;
    const next = { ...current, ...patch };
    this.tasks.set(taskId, next);
    return next;
  }

  async get(taskId: string): Promise<TaskRecord | undefined> {
    return this.tasks.get(taskId);
  }

  async find(handle: string): Promise<TaskRecord | undefined> {
    const value = String(handle ?? "").trim();
    if (!value) return undefined;
    for (const task of this.tasks.values()) if (task.taskId === value) return task;
    for (const task of this.tasks.values()) if (task.name === value) return task;
    for (const task of this.tasks.values()) if (task.paneId === value) return task;
    return undefined;
  }

  async list(): Promise<TaskRecord[]> {
    return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  async activeCount(): Promise<number> {
    return [...this.tasks.values()].filter((task) => isActiveStatus(task.status)).length;
  }

  async getWorkspace(key: string): Promise<WorkspaceRecord | undefined> {
    return this.workspaces.get(key);
  }

  async setWorkspace(
    key: string,
    value: Omit<WorkspaceRecord, "updatedAt">,
  ): Promise<WorkspaceRecord> {
    const record = { ...value, updatedAt: Date.now() };
    this.workspaces.set(key, record);
    return record;
  }
}
