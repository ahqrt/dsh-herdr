import type { DiffEvidence, GitBaseline } from "../../domain/types.js";
import type { MachineIo } from "../../ports/machine.js";
import type { GitDiffInput, GitService } from "../../ports/store.js";
export declare class RemoteGit implements GitService {
    private readonly io;
    constructor(io: MachineIo);
    isRepo(cwd: string): Promise<boolean>;
    baseline(cwd: string): Promise<GitBaseline | undefined>;
    diff(input: GitDiffInput): Promise<DiffEvidence | undefined>;
    status(cwd: string): Promise<string[]>;
    createWorktree(input: {
        repoCwd: string;
        path: string;
        branch: string;
        base?: string;
    }): Promise<void>;
    removeWorktree(input: {
        repoCwd: string;
        path: string;
        force?: boolean;
    }): Promise<void>;
    private git;
}
//# sourceMappingURL=remote-git.d.ts.map