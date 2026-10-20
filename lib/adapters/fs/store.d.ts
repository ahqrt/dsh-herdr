import type { TaskRecord, WorkspaceRecord } from "../../domain/types.js";
import type { AuditEvent, AuditLog, TaskStore } from "../../ports/store.js";
export declare class FileTaskStore implements TaskStore {
    private readonly stateFile;
    private readonly clock;
    private queue;
    private readonly lockPath;
    constructor(stateFile: string, clock?: {
        now(): number;
    });
    put(record: TaskRecord): Promise<TaskRecord>;
    update(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord | undefined>;
    get(taskId: string): Promise<TaskRecord | undefined>;
    find(handle: string): Promise<TaskRecord | undefined>;
    list(): Promise<TaskRecord[]>;
    activeCount(): Promise<number>;
    getWorkspace(key: string): Promise<WorkspaceRecord | undefined>;
    setWorkspace(key: string, value: Omit<WorkspaceRecord, "updatedAt">): Promise<WorkspaceRecord>;
    private mutate;
    private read;
    private write;
    private withLock;
    private breakStaleLock;
}
/** Append-only audit log with a simple size cap rotation. */
export declare class FileAuditLog implements AuditLog {
    private readonly path;
    private readonly maxBytes;
    constructor(path: string, maxBytes?: number);
    write(event: AuditEvent): void;
    private rotateIfNeeded;
}
//# sourceMappingURL=store.d.ts.map