import type { AuditLog, TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
export type MessageKind = "NOTE" | "REVIEW_FINDINGS" | "ACCEPT" | "REJECT" | "ANSWER";
export interface MessageInput {
    target: string;
    machine?: string;
    message: string;
    kind?: MessageKind;
    round?: number;
    wait?: boolean;
    timeoutMs?: number;
    signal?: AbortSignal;
}
export interface MessageResult {
    delivered: boolean;
    startedTurn: boolean;
    status?: string;
    target: string;
    machine?: string;
    message: string;
}
export interface MessageDeps {
    transports: TransportPool;
    store: TaskStore;
    audit: AuditLog;
}
export declare class MessageService {
    private readonly deps;
    constructor(deps: MessageDeps);
    send(input: MessageInput): Promise<MessageResult>;
}
//# sourceMappingURL=message.d.ts.map