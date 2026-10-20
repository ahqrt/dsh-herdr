export type InboxType = "BLOCKED" | "REVIEW_REQUEST" | "COMPLETE" | "NOTE" | "ACCEPT" | "REJECT";
export interface InboxMessage {
    /** Zero-based line number in inbox.ndjson. */
    index: number;
    ts?: string;
    type: InboxType;
    text: string;
}
export interface ParsedInbox {
    messages: InboxMessage[];
    malformed: number;
}
/** Parse an inbox file, tolerating a torn final line and unknown types. */
export declare function parseInbox(text: string): ParsedInbox;
/** How many lines were produced by a given text (the next offset). */
export declare function lineCount(text: string): number;
//# sourceMappingURL=inbox.d.ts.map