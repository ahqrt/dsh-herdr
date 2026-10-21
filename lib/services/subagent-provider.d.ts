import type { AgentResult } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
import type { HarvestService } from "./harvest.js";
import type { LifecycleService } from "./lifecycle.js";
import type { SpawnService } from "./spawn.js";
export interface SubagentRequest {
    prompt: string;
    cwd?: string;
    label?: string;
    parent?: unknown;
    signal?: AbortSignal;
}
export interface SubagentRunHandle {
    id: string;
    result: Promise<{
        output: {
            type: "text";
            text: string;
        }[];
        stopReason: string;
    }>;
    dispose(): Promise<void>;
}
export interface HerdrSubagentProviderDeps {
    config: PluginConfig;
    store: TaskStore;
    transports: TransportPool;
    spawn: SpawnService;
    harvest: HarvestService;
    lifecycle: LifecycleService;
}
export declare class HerdrSubagentProvider {
    private readonly deps;
    readonly name: string;
    readonly capabilities: {
        agentOptions: boolean;
        agentPreset: boolean;
        outputSchema: boolean;
        depthLimit: boolean;
    };
    readonly inheritsParentContext = false;
    constructor(deps: HerdrSubagentProviderDeps);
    start(request: SubagentRequest): Promise<SubagentRunHandle>;
    private startSettlement;
    private dispose;
}
/** Map the rich AgentResult onto the subagent service's terminal contract. */
export declare function toTerminal(result: AgentResult): {
    output: {
        type: "text";
        text: string;
    }[];
    stopReason: string;
};
//# sourceMappingURL=subagent-provider.d.ts.map