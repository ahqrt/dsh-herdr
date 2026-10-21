import type { WorktreeInfo } from "../domain/types.js";
import type { MachineRuntimePool } from "../ports/machine.js";
export interface WorktreeDeps {
    runtimes: MachineRuntimePool;
}
export declare class WorktreeService {
    private readonly deps;
    constructor(deps: WorktreeDeps);
    create(input: {
        repoCwd: string;
        taskId: string;
        machine?: string;
    }): Promise<WorktreeInfo>;
    remove(info: WorktreeInfo, force?: boolean, machine?: string): Promise<void>;
}
//# sourceMappingURL=worktree.d.ts.map