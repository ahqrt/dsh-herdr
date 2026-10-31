export interface TranscriptToolCall {
    name: string;
    /** One-line argument preview: the bash command, the edited path, ... */
    detail: string;
}
export interface TranscriptMessage {
    /** Zero-based turn index across the whole session. */
    index: number;
    role: "user" | "assistant" | "tool" | "system" | "other";
    text: string;
    toolCalls: TranscriptToolCall[];
    /** For role "tool": which tool produced this result. */
    toolName?: string;
    /** For role "tool": pi marked the call as failed. */
    isError?: boolean;
    /** For role "tool": wall time the call took. */
    durationMs?: number;
    timestamp?: string;
}
export interface TranscriptPage {
    messages: TranscriptMessage[];
    total: number;
}
/** A short, human-readable preview of one tool call's arguments. */
export declare function toolCallPreview(args: unknown): string;
/** Normalize session JSONL text into transcript turns. */
export declare function readTranscriptFromText(text: string): TranscriptMessage[];
/** Read a session file and normalize the whole transcript. */
export declare function readTranscript(sessionPath: string): TranscriptMessage[];
/** One page, clamped to the available range. */
export declare function pageTranscript(sessionPath: string, options?: {
    from?: number;
    limit?: number;
}): TranscriptPage;
//# sourceMappingURL=transcript.d.ts.map