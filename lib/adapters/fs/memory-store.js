// In-memory TaskStore for unit tests and embedders. Mirrors FileTaskStore's
// contract exactly, including activeCount semantics.
import { isActiveStatus } from "../../domain/status.js";
export class MemoryTaskStore {
    tasks = new Map();
    workspaces = new Map();
    async put(record) {
        this.tasks.set(record.taskId, record);
        return record;
    }
    async update(taskId, patch) {
        const current = this.tasks.get(taskId);
        if (!current)
            return undefined;
        const next = { ...current, ...patch };
        this.tasks.set(taskId, next);
        return next;
    }
    async get(taskId) {
        return this.tasks.get(taskId);
    }
    async find(handle) {
        const value = String(handle ?? "").trim();
        if (!value)
            return undefined;
        for (const task of this.tasks.values())
            if (task.taskId === value)
                return task;
        for (const task of this.tasks.values())
            if (task.name === value)
                return task;
        for (const task of this.tasks.values())
            if (task.paneId === value)
                return task;
        return undefined;
    }
    async list() {
        return [...this.tasks.values()].sort((a, b) => b.createdAt - a.createdAt);
    }
    async activeCount() {
        return [...this.tasks.values()].filter((task) => isActiveStatus(task.status)).length;
    }
    async getWorkspace(key) {
        return this.workspaces.get(key);
    }
    async setWorkspace(key, value) {
        const record = { ...value, updatedAt: Date.now() };
        this.workspaces.set(key, record);
        return record;
    }
}
//# sourceMappingURL=memory-store.js.map