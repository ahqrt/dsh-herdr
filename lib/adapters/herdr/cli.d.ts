import { type ErrorCode } from "../../domain/errors.js";
import { type Result } from "../../domain/result.js";
import { type HerdrProbe } from "../../domain/version.js";
export interface CliOptions {
    timeoutMs?: number;
    signal?: AbortSignal;
    /** The command prints plain text on success (agent read, status, --version). */
    text?: boolean;
    /** The command prints its answer on stderr and exits non-zero (agent help). */
    allowNonZeroText?: boolean;
    /** Internal: the version probe must run below the floor. */
    skipFloorGate?: boolean;
}
/** Resolve the binary: explicit config, $HERDR_BIN, PATH walk, then bare name. */
export declare function resolveHerdrBin(configured?: string, env?: NodeJS.ProcessEnv): string;
/** Map a raw herdr error code onto the plugin's stable codes. */
export declare function mapHerdrCode(raw: unknown): ErrorCode;
/** Parse the last JSON object in a possibly-mixed output buffer. */
export declare function parseLastJson(text: string): unknown;
export declare class HerdrCli {
    private readonly bin;
    private readonly env;
    private probeCache;
    constructor(bin: string, env?: NodeJS.ProcessEnv);
    /** Cached `herdr --version`; `refresh` re-runs it (doctor, session start). */
    probe(refresh?: boolean): Promise<HerdrProbe>;
    /** Gated exec: refuses below the floor, then runs. */
    exec<T = unknown>(args: string[], options?: CliOptions): Promise<Result<T>>;
    /** Sensible default timeouts per command family. */
    execWithDefaultTimeout<T = unknown>(args: string[], options?: CliOptions): Promise<Result<T>>;
    private run;
}
//# sourceMappingURL=cli.d.ts.map