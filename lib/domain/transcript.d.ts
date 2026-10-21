export interface TranscriptMessage {
    /** Zero-based turn index across the whole session. */
    index: number;
    role: "user" | "assistant" | "system" | "other";
    text: string;
    toolCalls: string[];
    timestamp?: string;
}
export interface TranscriptPage {
    messages: TranscriptMessage[];
    total: number;
}
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