import type { AuditLog, TaskStore } from "../ports/store.js";
import type { HerdrTransport } from "../ports/transport.js";
export type MessageKind = "NOTE" | "REVIEW_FINDINGS" | "ACCEPT" | "REJECT" | "ANSWER";
export interface MessageInput {
    target: string;
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
    message: string;
}
export interface MessageDeps {
    transport: HerdrTransport;
    store: TaskStore;
    audit: AuditLog;
}
export declare class MessageService {
    private readonly deps;
    constructor(deps: MessageDeps);
    send(input: MessageInput): Promise<MessageResult>;
}
//# sourceMappingURL=message.d.ts.map