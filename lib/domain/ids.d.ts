export interface Clock {
    now(): number;
}
export interface IdSource {
    taskId(now: number): string;
    suffix(): string;
}
export declare const systemClock: Clock;
export declare const systemIds: IdSource;
export declare const AGENT_NAME_RE: RegExp;
/** Lowercase, strip anything Herdr rejects, keep a letter first. */
export declare function normalizeAgentName(raw: string, fallback?: string): string;
/** Build a readable, collision-resistant name from role + model/kind. */
export declare function makeAgentName(input: {
    role: string;
    flavor: string;
    suffix: string;
    taken?: ReadonlySet<string>;
}): string;
/** A short, filename-safe id for a caller-supplied idempotency key. */
export declare function shortHash(value: string): string;
//# sourceMappingURL=ids.d.ts.map