// Stable error vocabulary. Every failure a user can hit has one code, one
// human sentence, and (when we know it) one remediation. Tools render the
// remediation as a `fix:` line; docs/errors.md mirrors this table.
/** The only error type crossing a service boundary. */
export class HerdrError extends Error {
    code;
    remediation;
    details;
    constructor(code, message, options = {}) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = "HerdrError";
        this.code = code;
        this.remediation = options.remediation;
        this.details = options.details;
    }
    /** The model-facing rendering: code, message, and the fix when known. */
    toToolMessage() {
        return this.remediation
            ? `HERDR_${this.code}: ${this.message}\nfix: ${this.remediation}`
            : `HERDR_${this.code}: ${this.message}`;
    }
}
/** Wrap anything thrown at a tool boundary. */
export function asHerdrError(error) {
    if (error instanceof HerdrError)
        return error;
    if (error instanceof Error) {
        return new HerdrError("VALIDATION_ERROR", error.message, { cause: error });
    }
    return new HerdrError("VALIDATION_ERROR", String(error));
}
/** Convert a thrown value into the Error a DSH tool should reject with. */
export function toToolError(error) {
    return new Error(asHerdrError(error).toToolMessage());
}
/** Type guard for callers that need the raw code. */
export function isHerdrError(error) {
    return error instanceof HerdrError;
}
//# sourceMappingURL=errors.js.map