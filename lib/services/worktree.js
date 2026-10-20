// Per-task isolated worktrees.
//
// A delegation can run in a fresh `git worktree` instead of the user's dirty
// checkout. The branch is named after the task, the path lives under the DSH
// home, and nothing is merged automatically: the result carries the path so a
// human (or DSH) can review and merge deliberately.
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { HerdrError } from "../domain/errors.js";
export class WorktreeService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async create(input) {
        const { git, config, paths } = this.deps;
        const repo = resolve(input.repoCwd);
        if (!(await git.isRepo(repo))) {
            throw new HerdrError("VALIDATION_ERROR", "isolated:true needs a git repository at cwd", {
                remediation: "run the delegation in a git repo, or omit isolated",
            });
        }
        const repoName = basename(repo) || "repo";
        const path = join(paths.worktreesRoot, `${repoName}-${input.taskId}`);
        const branch = `dsh/${input.taskId}`;
        mkdirSync(paths.worktreesRoot, { recursive: true });
        await git.createWorktree({ repoCwd: repo, path, branch, base: "HEAD" });
        return { path, branch, repo, base: "HEAD" };
    }
    async remove(info, force = false) {
        await this.deps.git.removeWorktree({ repoCwd: info.repo, path: info.path, force });
    }
}
//# sourceMappingURL=worktree.js.map