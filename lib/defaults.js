// Configuration defaults and normalization. Pure: no DSH import, no I/O.
export const DEFAULT_CONFIG = {
    enabled: true,
    herdrBin: "herdr",
    defaultKind: "pi",
    defaultModel: "flash",
    aliasesFile: "~/.pi/agent/model-aliases.md",
    maxParallelAgents: 3,
    defaultTimeoutMs: 900_000,
    startTimeoutMs: 60_000,
    maxResultChars: 40_000,
    maxDiffBytes: 512 * 1024,
    topology: "auto",
    splitDirection: "right",
    workspaceLabel: "DSH · {repo}",
    homeDir: "~/.dsh/herdr",
    artifactsRoot: "tasks",
    stateFile: "state.json",
    auditFile: "audit.ndjson",
    allowCwd: [],
};
/** Merge loader input over defaults and coerce the knobs that have ranges. */
export function resolveConfig(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const merged = { ...DEFAULT_CONFIG };
    for (const key of Object.keys(DEFAULT_CONFIG)) {
        const value = input[key];
        if (value === undefined || value === null)
            continue;
        const fallback = DEFAULT_CONFIG[key];
        if (typeof fallback === "boolean") {
            merged[key] = Boolean(value);
        }
        else if (typeof fallback === "number") {
            const numeric = Number(value);
            if (Number.isFinite(numeric))
                merged[key] = numeric;
        }
        else if (Array.isArray(fallback)) {
            merged[key] = (Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []);
        }
        else {
            merged[key] = String(value);
        }
    }
    if (!["auto", "workspace", "split"].includes(merged.topology))
        merged.topology = "auto";
    if (!["right", "down"].includes(merged.splitDirection))
        merged.splitDirection = "right";
    merged.maxParallelAgents = clampInteger(merged.maxParallelAgents, 1, 32, 3);
    merged.defaultTimeoutMs = clampInteger(merged.defaultTimeoutMs, 10_000, 3_600_000, 900_000);
    merged.startTimeoutMs = clampInteger(merged.startTimeoutMs, 5_000, 300_000, 60_000);
    merged.maxResultChars = clampInteger(merged.maxResultChars, 1_000, 400_000, 40_000);
    merged.maxDiffBytes = clampInteger(merged.maxDiffBytes, 1_024, 16 * 1024 * 1024, 512 * 1024);
    return merged;
}
function clampInteger(value, min, max, fallback) {
    if (!Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
}
//# sourceMappingURL=defaults.js.map