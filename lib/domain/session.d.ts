import type { SessionUsage } from "./types.js";
export interface ParsedSession {
    entries: Record<string, unknown>[];
    /** Lines skipped because they were not complete JSON (torn tail). */
    malformed: number;
}
export interface ExtractedResult {
    message: Record<string, unknown>;
    text: string;
}
/** Parse a session file's text, tolerating a torn final line. */
export declare function parseSessionEntries(text: string): ParsedSession;
/** The exact text content of an assistant message (text blocks joined). */
export declare function assistantText(message: unknown): string;
/** The last assistant message in parsed entries, or null. */
export declare function extractLastAssistant(entries: Record<string, unknown>[]): ExtractedResult | null;
/** Read a session file and extract its last assistant message. */
export declare function extractSessionResult(sessionPath: string): ExtractedResult | null;
/** Mine typed failure info: pi marks an exhausted turn with stopReason=error. */
export declare function minedAssistantError(message: unknown): {
    stopReason: string;
    errorMessage: string;
} | null;
/** mtime in ms, or 0 when the file is missing. */
export declare function sessionMtime(sessionPath: string | undefined): number;
/** Count assistant messages / tool calls / output tokens. */
export declare function sessionStats(sessionPath: string | undefined): SessionUsage | undefined;
//# sourceMappingURL=session.d.ts.map