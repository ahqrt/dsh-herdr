import { type InboxMessage } from "../domain/inbox.js";
import type { TaskStatus } from "../domain/types.js";
import type { TaskStore } from "../ports/store.js";
export interface InboxEntry extends InboxMessage {
    taskId: string;
    name: string;
    taskStatus: TaskStatus;
}
export interface InboxReadInput {
    target?: string;
    wait?: boolean;
    timeoutMs?: number;
    consume?: boolean;
    limit?: number;
    signal?: AbortSignal;
}
export interface InboxReadResult {
    messages: InboxEntry[];
    /** Messages left for later (limit or later reads). */
    remaining: number;
    waitedMs: number;
    /** Lines that were not valid message objects. */
    malformed: number;
}
export interface InboxDeps {
    store: TaskStore;
}
export declare class InboxService {
    private readonly deps;
    constructor(deps: InboxDeps);
    read(input?: InboxReadInput): Promise<InboxReadResult>;
    private targets;
    private snapshot;
    private consume;
}
//# sourceMappingURL=inbox.d.ts.map