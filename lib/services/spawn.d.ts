import type { AgentResult, SpawnInput } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { AuditLog, GitService, TaskStore } from "../ports/store.js";
import type { HerdrTransport } from "../ports/transport.js";
import type { Paths } from "../domain/paths.js";
import type { Clock, IdSource } from "../domain/ids.js";
import type { HarvestService } from "./harvest.js";
import type { TopologyService } from "./topology.js";
export interface SpawnDeps {
    transport: HerdrTransport;
    store: TaskStore;
    git: GitService;
    topology: TopologyService;
    harvest: HarvestService;
    config: PluginConfig;
    paths: Paths;
    audit: AuditLog;
    clock: Clock;
    ids: IdSource;
}
export declare class SpawnService {
    private readonly deps;
    constructor(deps: SpawnDeps);
    spawn(input: SpawnInput): Promise<AgentResult>;
    private submit;
    private waitForBoot;
    private interruptQuietly;
}
//# sourceMappingURL=spawn.d.ts.map