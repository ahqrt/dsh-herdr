import type { TaskRecord } from "../domain/types.js";
import type { AuditLog, TaskStore } from "../ports/store.js";
import type { HerdrTransport } from "../ports/transport.js";
export interface LifecycleDeps {
    transport: HerdrTransport;
    store: TaskStore;
    audit: AuditLog;
}
export interface CloseInput {
    target: string;
    force?: boolean;
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
    ageMs?: number;
}
//# sourceMappingURL=lifecycle.d.ts.map