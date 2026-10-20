import type { AgentResult, TaskRecord } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { GitService } from "../ports/store.js";
import type { HerdrTransport } from "../ports/transport.js";
export interface HarvestOptions {
    signal?: AbortSignal;
    tailLines?: number;
    withDiff?: boolean;
}
export interface HarvestDeps {
    transport: HerdrTransport;
    git: GitService;
    config: PluginConfig;
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