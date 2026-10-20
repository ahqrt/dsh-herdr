import { type Result } from "./result.js";
export interface HerdrVersion {
    major: number;
    minor: number;
    patch: number;
}
export type HerdrProbe = {
    state: "ok";
    version: HerdrVersion;
} | {
    state: "missing";
} | {
    state: "unknown";
};
export declare const MIN_HERDR_VERSION: HerdrVersion;
export declare const HERDR_UPGRADE_POINTER = "https://herdr.dev";
/** Parse the first MAJOR.MINOR.PATCH out of a `herdr --version` string. */
export declare function parseVersion(text: string): HerdrVersion | null;
export declare function formatVersion(version: HerdrVersion): string;
/** True when the version is at or above MAJOR.MINOR (patch ignored). */
export declare function isAtLeast(version: HerdrVersion | null, major: number, minor: number): boolean;
/**
 * The floor verdict: null means "run it". `missing` also returns null so the
 * natural HERDR_UNAVAILABLE error is the single failure, not two.
 */
export declare function floorError(probe: HerdrProbe): Result<never> | null;
/** Narrow a raw agent status string onto the herdr state machine. */
export declare function normalizeStatus(value: unknown): import("./types.js").HerdrAgentStatus | undefined;
//# sourceMappingURL=version.d.ts.map