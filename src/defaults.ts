// Configuration defaults and normalization. Pure: no DSH import, no I/O.

export type Topology = "auto" | "workspace" | "split";

export interface PluginConfig {
  enabled: boolean;
  herdrBin: string;
  transport: "auto" | "cli" | "socket";
  socketPath: string;
  defaultKind: string;
  defaultModel: string;
  /** Register a DSH subagent provider backed by Herdr. */
  nativeSubagent: boolean;
  /** Provider name used by a dsh-tool-subagent row. */
  subagentName: string;
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

export const DEFAULT_CONFIG: PluginConfig = {
  enabled: true,
  herdrBin: "herdr",
  transport: "cli",
  socketPath: "~/.config/herdr/herdr.sock",
  defaultKind: "pi",
  defaultModel: "flash",
  nativeSubagent: true,
  subagentName: "herdr",
  aliasesFile: "~/.pi/agent/model-aliases.md",
  maxParallelAgents: 3,
  queueTimeoutMs: 300_000,
  maxQueuedAgents: 10,
  defaultTimeoutMs: 900_000,
  startTimeoutMs: 60_000,
  maxResultChars: 40_000,
  maxDiffBytes: 512 * 1024,
  topology: "auto",
  splitDirection: "right",
  workspaceLabel: "DSH · {repo}",
  homeDir: "~/.dsh/herdr",
  artifactsRoot: "tasks",
  worktreesRoot: "worktrees",
  stateFile: "state.json",
  auditFile: "audit.ndjson",
  allowCwd: [],
  machines: [],
  sharedFilesystem: [],
  machineTargets: [],
  remoteHomeDir: "~/.dsh/herdr",
};

/** Merge loader input over defaults and coerce the knobs that have ranges. */
export function resolveConfig(raw: unknown): PluginConfig {
  const input = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const merged: PluginConfig = { ...DEFAULT_CONFIG };

  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof PluginConfig)[]) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    const fallback = DEFAULT_CONFIG[key];
    if (typeof fallback === "boolean") {
      merged[key] = Boolean(value) as never;
    } else if (typeof fallback === "number") {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) merged[key] = numeric as never;
    } else if (Array.isArray(fallback)) {
      merged[key] = (
        Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []
      ) as never;
    } else {
      merged[key] = String(value) as never;
    }
  }

  if (!["auto", "cli", "socket"].includes(merged.transport)) merged.transport = "auto";
  if (!["auto", "workspace", "split"].includes(merged.topology)) merged.topology = "auto";
  if (!["right", "down"].includes(merged.splitDirection)) merged.splitDirection = "right";

  merged.maxParallelAgents = clampInteger(merged.maxParallelAgents, 1, 32, 3);
  merged.queueTimeoutMs = clampInteger(merged.queueTimeoutMs, 0, 1_800_000, 300_000);
  merged.maxQueuedAgents = clampInteger(merged.maxQueuedAgents, 0, 64, 10);
  merged.defaultTimeoutMs = clampInteger(merged.defaultTimeoutMs, 10_000, 3_600_000, 900_000);
  merged.startTimeoutMs = clampInteger(merged.startTimeoutMs, 5_000, 300_000, 60_000);
  merged.maxResultChars = clampInteger(merged.maxResultChars, 1_000, 400_000, 40_000);
  merged.maxDiffBytes = clampInteger(merged.maxDiffBytes, 1_024, 16 * 1024 * 1024, 512 * 1024);
  return merged;
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}
