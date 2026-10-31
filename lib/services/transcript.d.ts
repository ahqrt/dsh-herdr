import type { TranscriptMessage } from "../domain/transcript.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
export interface TranscriptReadInput {
    target: string;
    from?: number;
    limit?: number;
    /** Return the last `limit` turns instead of the first page. */
    tail?: boolean;
    signal?: AbortSignal;
}
export interface TranscriptReadResult {
    taskId: string;
    name: string;
    sessionPath: string;
    messages: TranscriptMessage[];
    total: number;
    /** Offset to pass as `from` for the next (later) page, when one exists. */
    nextFrom?: number;
    /** Offset to pass as `from` for the previous (earlier) page, when one exists. */
    prevFrom?: number;
}
export declare class TranscriptService {
    private readonly store;
    private readonly runtimes;
    private readonly transports?;
    constructor(store: TaskStore, runtimes: MachineRuntimePool, transports?: TransportPool | undefined);
    read(input: TranscriptReadInput): Promise<TranscriptReadResult>;
    private resolve;
}
//# sourceMappingURL=transcript.d.ts.map