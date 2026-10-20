import { type ErrorCode } from "./errors.js";
export interface Ok<T> {
    ok: true;
    data: T;
}
export interface Err {
    ok: false;
    error: {
        code: ErrorCode;
        message: string;
        remediation?: string;
        details?: unknown;
    };
}
export type Result<T> = Ok<T> | Err;
export declare function ok<T>(data: T): Ok<T>;
export declare function err(code: ErrorCode, message: string, options?: {
    remediation?: string;
    details?: unknown;
}): Err;
/** Extract a value or throw the typed error. */
export declare function unwrap<T>(result: Result<T>): T;
//# sourceMappingURL=result.d.ts.map