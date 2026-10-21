// Configuration schema for the DSH loader. The pure merge lives in
// defaults.ts so tests and embedders never need a DSH package.
import z from "@deepseek-ai/schemastery";
import { DEFAULT_CONFIG, resolveConfig } from "./defaults.js";
export { DEFAULT_CONFIG, resolveConfig };
export const Config = z.object({
    enabled: z.boolean().default(DEFAULT_CONFIG.enabled),
    herdrBin: z.string().default(DEFAULT_CONFIG.herdrBin),
    transport: z.string().default(DEFAULT_CONFIG.transport),
    socketPath: z.string().default(DEFAULT_CONFIG.socketPath),
    defaultKind: z.string().default(DEFAULT_CONFIG.defaultKind),
    defaultModel: z.string().default(DEFAULT_CONFIG.defaultModel),
    nativeSubagent: z.boolean().default(DEFAULT_CONFIG.nativeSubagent),
    subagentName: z.string().default(DEFAULT_CONFIG.subagentName),
    editorCommand: z.string().default(DEFAULT_CONFIG.editorCommand),
    editorArgs: z.array(z.string()).default(DEFAULT_CONFIG.editorArgs),
    aliasesFile: z.string().default(DEFAULT_CONFIG.aliasesFile),
    maxParallelAgents: z.number().default(DEFAULT_CONFIG.maxParallelAgents),
    queueTimeoutMs: z.number().default(DEFAULT_CONFIG.queueTimeoutMs),
    maxQueuedAgents: z.number().default(DEFAULT_CONFIG.maxQueuedAgents),
    defaultTimeoutMs: z.number().default(DEFAULT_CONFIG.defaultTimeoutMs),
    startTimeoutMs: z.number().default(DEFAULT_CONFIG.startTimeoutMs),
    maxResultChars: z.number().default(DEFAULT_CONFIG.maxResultChars),
    maxDiffBytes: z.number().default(DEFAULT_CONFIG.maxDiffBytes),
    topology: z.string().default(DEFAULT_CONFIG.topology),
    splitDirection: z.string().default(DEFAULT_CONFIG.splitDirection),
    workspaceLabel: z.string().default(DEFAULT_CONFIG.workspaceLabel),
    homeDir: z.string().default(DEFAULT_CONFIG.homeDir),
    artifactsRoot: z.string().default(DEFAULT_CONFIG.artifactsRoot),
    worktreesRoot: z.string().default(DEFAULT_CONFIG.worktreesRoot),
    stateFile: z.string().default(DEFAULT_CONFIG.stateFile),
    auditFile: z.string().default(DEFAULT_CONFIG.auditFile),
    allowCwd: z.array(z.string()).default([]),
    machines: z.array(z.string()).default([]),
    sharedFilesystem: z.array(z.string()).default([]),
    machineTargets: z.array(z.string()).default([]),
    remoteHomeDir: z.string().default(DEFAULT_CONFIG.remoteHomeDir),
});
//# sourceMappingURL=config.js.map