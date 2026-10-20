import type { WorktreeInfo } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { Paths } from "../domain/paths.js";
import type { GitService } from "../ports/store.js";
export interface WorktreeDeps {
    git: GitService;
    config: PluginConfig;
    paths: Paths;
}
export declare class WorktreeService {
    private readonly deps;
    constructor(deps: WorktreeDeps);
    create(input: {
        repoCwd: string;
        taskId: string;
    }): Promise<WorktreeInfo>;
    remove(info: WorktreeInfo, force?: boolean): Promise<void>;
}
//# sourceMappingURL=worktree.d.ts.map