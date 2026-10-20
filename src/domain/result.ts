// A tiny Result type for operations whose failure is a value, not a throw.
// Services return Result; tools turn a failed Result into HerdrError.

import { HerdrError, type ErrorCode } from "./errors.js";

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

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err(
  code: ErrorCode,
  message: string,
  options: { remediation?: string; details?: unknown } = {},
): Err {
  return { ok: false, error: { code, message, ...options } };
}

/** Extract a value or throw the typed error. */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.data;
  throw new HerdrError(result.error.code, result.error.message, {
    remediation: result.error.remediation,
    details: result.error.details,
  });
}
