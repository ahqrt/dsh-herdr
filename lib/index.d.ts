import { Config } from "./config.js";
import { TOOL_NAMES } from "./tools/index.js";
import type { PluginContext } from "./host.js";
export declare const name = "tool-herdr";
export declare const inject: string[];
export { Config, TOOL_NAMES };
export type { PluginConfig } from "./defaults.js";
export type { AgentResult, AgentInfo, DiffEvidence, TaskRecord, TaskStatus, } from "./domain/types.js";
export declare function apply(ctx: PluginContext, rawConfig?: unknown): void;
//# sourceMappingURL=index.d.ts.map