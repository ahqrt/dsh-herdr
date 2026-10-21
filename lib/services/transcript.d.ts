import type { TranscriptMessage } from "../domain/transcript.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TaskStore } from "../ports/store.js";
export interface TranscriptReadInput {
    target: string;
    from?: number;
    limit?: number;
    signal?: AbortSignal;
}
export interface TranscriptReadResult {
    taskId: string;
    name: string;
    sessionPath: string;
    messages: TranscriptMessage[];
    total: number;
    /** Offset to pass as `from` for the next page, when one exists. */
    nextFrom?: number;
}
export declare class TranscriptService {
    private readonly store;
    private readonly runtimes;
    constructor(store: TaskStore, runtimes: MachineRuntimePool);
    read(input: TranscriptReadInput): Promise<TranscriptReadResult>;
    private resolve;
}
//# sourceMappingURL=transcript.d.ts.map