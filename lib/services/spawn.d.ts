import type { AgentResult, SpawnInput } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { AuditLog, GitService, TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
import type { Paths } from "../domain/paths.js";
import type { Clock, IdSource } from "../domain/ids.js";
import type { HarvestService } from "./harvest.js";
import type { TopologyService } from "./topology.js";
import type { WorktreeService } from "./worktree.js";
export interface SpawnDeps {
    transports: TransportPool;
    store: TaskStore;
    git: GitService;
    topology: TopologyService;
    harvest: HarvestService;
    worktree: WorktreeService;
    config: PluginConfig;
    paths: Paths;
    audit: AuditLog;
    clock: Clock;
    ids: IdSource;
}
export declare class SpawnService {
    private readonly deps;
    private reservations;
    private waiters;
    constructor(deps: SpawnDeps);
    spawn(input: SpawnInput): Promise<AgentResult>;
    /** Wait for a concurrency slot; reservations stop same-process oversubscription. */
    private waitForSlot;
    private hasSlot;
    private capReached;
    private submit;
    private waitForBoot;
    private interruptQuietly;
}
//# sourceMappingURL=spawn.d.ts.map