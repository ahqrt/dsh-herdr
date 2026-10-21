import type { TaskRecord } from "../domain/types.js";
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
export declare class LifecycleService {
    private readonly deps;
    constructor(deps: LifecycleDeps);
    close(input: CloseInput): Promise<CloseResult>;
    interrupt(target: string, signal?: AbortSignal): Promise<{
        interrupted: boolean;
        message: string;
    }>;
    /** Owned records joined with the live Herdr fleet. */
    list(options?: {
        ownedOnly?: boolean;
        machine?: string;
        signal?: AbortSignal;
    }): Promise<FleetRow[]>;
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
//# sourceMappingURL=lifecycle.d.ts.map