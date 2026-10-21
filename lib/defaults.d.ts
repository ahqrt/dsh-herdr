export type Topology = "auto" | "workspace" | "split";
export interface PluginConfig {
    enabled: boolean;
    herdrBin: string;
    transport: "auto" | "cli" | "socket";
    socketPath: string;
    defaultKind: string;
    defaultModel: string;
    aliasesFile: string;
    maxParallelAgents: number;
    queueTimeoutMs: number;
    maxQueuedAgents: number;
    defaultTimeoutMs: number;
    startTimeoutMs: number;
    maxResultChars: number;
    maxDiffBytes: number;
    topology: Topology;
    splitDirection: "right" | "down";
    workspaceLabel: string;
    homeDir: string;
    artifactsRoot: string;
    worktreesRoot: string;
    stateFile: string;
    auditFile: string;
    allowCwd: string[];
    /** Enabled Herdr `--machine` profiles this plugin may target. */
    machines: string[];
    /** Machine labels whose filesystem is mounted locally. */
    sharedFilesystem: string[];
    /** Remote machines with SSH file access, as `label=ssh-target`. */
    machineTargets: string[];
    /** Remote root for tasks/worktrees (resolved against the remote $HOME). */
    remoteHomeDir: string;
}
export declare const DEFAULT_CONFIG: PluginConfig;
/** Merge loader input over defaults and coerce the knobs that have ranges. */
export declare function resolveConfig(raw: unknown): PluginConfig;
//# sourceMappingURL=defaults.d.ts.map