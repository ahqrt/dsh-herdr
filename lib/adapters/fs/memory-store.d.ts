import type { TaskRecord, WorkspaceRecord } from "../../domain/types.js";
import type { TaskStore } from "../../ports/store.js";
export declare class MemoryTaskStore implements TaskStore {
    private readonly tasks;
    private readonly workspaces;
    put(record: TaskRecord): Promise<TaskRecord>;
    update(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord | undefined>;
    get(taskId: string): Promise<TaskRecord | undefined>;
    find(handle: string): Promise<TaskRecord | undefined>;
    list(): Promise<TaskRecord[]>;
    activeCount(): Promise<number>;
    getWorkspace(key: string): Promise<WorkspaceRecord | undefined>;
    setWorkspace(key: string, value: Omit<WorkspaceRecord, "updatedAt">): Promise<WorkspaceRecord>;
}
//# sourceMappingURL=memory-store.d.ts.map