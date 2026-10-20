import { type PluginConfig } from "../defaults.js";
export interface Paths {
    root: string;
    stateFile: string;
    artifactsRoot: string;
    worktreesRoot: string;
    auditFile: string;
    aliasesFile: string;
}
/** Expand a leading `~` and resolve to an absolute path. */
export declare function expandHome(value: string, home?: string): string;
export declare function resolvePaths(config: Partial<PluginConfig>): Paths;
export declare function ensureDir(dir: string): string;
/** Stable key for a working directory (used to reuse the DSH workspace). */
export declare function repoKey(cwd: string): string;
/** The workspace label DSH uses for a repository. */
export declare function workspaceLabel(template: string, cwd: string): string;
/** True when `child` is `root` or below it (no `..` escape). */
export declare function isWithin(child: string, root: string): boolean;
//# sourceMappingURL=paths.d.ts.map