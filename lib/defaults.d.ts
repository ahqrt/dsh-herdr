export type Topology = "auto" | "workspace" | "split";
export interface PluginConfig {
    enabled: boolean;
    herdrBin: string;
    defaultKind: string;
    defaultModel: string;
    aliasesFile: string;
    maxParallelAgents: number;
    defaultTimeoutMs: number;
    startTimeoutMs: number;
    maxResultChars: number;
    maxDiffBytes: number;
    topology: Topology;
    splitDirection: "right" | "down";
    workspaceLabel: string;
    homeDir: string;
    artifactsRoot: string;
    stateFile: string;
    auditFile: string;
    allowCwd: string[];
    keepPanes: boolean;
}
export declare const DEFAULT_CONFIG: PluginConfig;
/** Merge loader input over defaults and coerce the knobs that have ranges. */
export declare function resolveConfig(raw: unknown): PluginConfig;
//# sourceMappingURL=defaults.d.ts.map