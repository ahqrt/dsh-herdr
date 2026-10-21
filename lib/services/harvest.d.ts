import type { AgentResult, TaskRecord } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { Paths } from "../domain/paths.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TransportPool } from "../ports/transports.js";
export interface HarvestOptions {
    signal?: AbortSignal;
    tailLines?: number;
    withDiff?: boolean;
}
export interface HarvestDeps {
    transports: TransportPool;
    runtimes: MachineRuntimePool;
    config: PluginConfig;
    paths: Paths;
}
export declare class HarvestService {
    private readonly deps;
    constructor(deps: HarvestDeps);
    harvest(record: TaskRecord, options?: HarvestOptions): Promise<AgentResult>;
    private readTail;
}
/** Strip ANSI and TUI chrome, keep the last meaningful lines as the question. */
export declare function extractQuestion(tail: string): string;
//# sourceMappingURL=harvest.d.ts.map