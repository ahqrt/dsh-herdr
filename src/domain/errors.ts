// Stable error vocabulary. Every failure a user can hit has one code, one
// human sentence, and (when we know it) one remediation. Tools render the
// remediation as a `fix:` line; docs/errors.md mirrors this table.

export type ErrorCode =
  | "HERDR_UNAVAILABLE"
  | "HERDR_TOO_OLD"
  | "HERDR_PROTOCOL"
  | "AGENT_NOT_FOUND"
  | "PANE_GONE"
  | "AGENT_BLOCKED"
  | "AGENT_STALLED"
  | "SPAWN_REFUSED"
  | "CONCURRENCY_LIMIT"
  | "CWD_NOT_ALLOWED"
  | "TASK_NOT_FOUND"
  | "TASK_NOT_OWNED"
  | "NO_TRANSCRIPT"
  | "VALIDATION_ERROR"
  | "TIMEOUT"
  | "ABORTED"
  | "STORE_UNAVAILABLE";

export interface HerdrErrorOptions {
  remediation?: string;
  details?: unknown;
  cause?: unknown;
}

/** The only error type crossing a service boundary. */
export class HerdrError extends Error {
  readonly code: ErrorCode;
  readonly remediation?: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, options: HerdrErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "HerdrError";
    this.code = code;
    this.remediation = options.remediation;
    this.details = options.details;
  }

  /** The model-facing rendering: code, message, and the fix when known. */
  toToolMessage(): string {
    return this.remediation
      ? `HERDR_${this.code}: ${this.message}\nfix: ${this.remediation}`
      : `HERDR_${this.code}: ${this.message}`;
  }
}

/** Wrap anything thrown at a tool boundary. */
export function asHerdrError(error: unknown): HerdrError {
  if (error instanceof HerdrError) return error;
  if (error instanceof Error) {
    return new HerdrError("VALIDATION_ERROR", error.message, { cause: error });
  }
  return new HerdrError("VALIDATION_ERROR", String(error));
}

/** Convert a thrown value into the Error a DSH tool should reject with. */
export function toToolError(error: unknown): Error {
  return new Error(asHerdrError(error).toToolMessage());
}

/** Type guard for callers that need the raw code. */
export function isHerdrError(error: unknown): error is HerdrError {
  return error instanceof HerdrError;
}
