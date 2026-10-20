import type { DiffEvidence, GitBaseline } from "../../domain/types.js";
import type { GitDiffInput, GitService } from "../../ports/store.js";
export declare class LocalGit implements GitService {
    isRepo(cwd: string): Promise<boolean>;
    baseline(cwd: string): Promise<GitBaseline | undefined>;
    diff(input: GitDiffInput): Promise<DiffEvidence | undefined>;
    status(cwd: string): Promise<string[]>;
}
//# sourceMappingURL=local.d.ts.map