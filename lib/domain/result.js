// A tiny Result type for operations whose failure is a value, not a throw.
// Services return Result; tools turn a failed Result into HerdrError.
import { HerdrError } from "./errors.js";
export function ok(data) {
    return { ok: true, data };
}
export function err(code, message, options = {}) {
    return { ok: false, error: { code, message, ...options } };
}
/** Extract a value or throw the typed error. */
export function unwrap(result) {
    if (result.ok)
        return result.data;
    throw new HerdrError(result.error.code, result.error.message, {
        remediation: result.error.remediation,
        details: result.error.details,
    });
}
//# sourceMappingURL=result.js.map