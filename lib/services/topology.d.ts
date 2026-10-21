import type { PaneTarget } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { TransportPool } from "../ports/transports.js";
import type { TaskStore } from "../ports/store.js";
export interface TopologyDeps {
    transports: TransportPool;
    store: TaskStore;
    config: PluginConfig;
    env: NodeJS.ProcessEnv;
}
export declare class TopologyService {
    private readonly deps;
    constructor(deps: TopologyDeps);
    ensurePane(input: {
        cwd: string;
        name: string;
        machine?: string;
        signal?: AbortSignal;
    }): Promise<PaneTarget>;
    private ensureWorkspacePane;
}
//# sourceMappingURL=topology.d.ts.map