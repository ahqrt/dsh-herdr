export type ErrorCode = "HERDR_UNAVAILABLE" | "HERDR_TOO_OLD" | "HERDR_PROTOCOL" | "AGENT_NOT_FOUND" | "PANE_GONE" | "AGENT_BLOCKED" | "AGENT_STALLED" | "SPAWN_REFUSED" | "CONCURRENCY_LIMIT" | "CWD_NOT_ALLOWED" | "TASK_NOT_FOUND" | "TASK_NOT_OWNED" | "NO_TRANSCRIPT" | "VALIDATION_ERROR" | "TIMEOUT" | "ABORTED" | "STORE_UNAVAILABLE";
export interface HerdrErrorOptions {
    remediation?: string;
    details?: unknown;
    cause?: unknown;
}
/** The only error type crossing a service boundary. */
export declare class HerdrError extends Error {
    readonly code: ErrorCode;
    readonly remediation?: string;
    readonly details?: unknown;
    constructor(code: ErrorCode, message: string, options?: HerdrErrorOptions);
    /** The model-facing rendering: code, message, and the fix when known. */
    toToolMessage(): string;
}
/** Wrap anything thrown at a tool boundary. */
export declare function asHerdrError(error: unknown): HerdrError;
/** Convert a thrown value into the Error a DSH tool should reject with. */
export declare function toToolError(error: unknown): Error;
/** Type guard for callers that need the raw code. */
export declare function isHerdrError(error: unknown): error is HerdrError;
//# sourceMappingURL=errors.d.ts.map