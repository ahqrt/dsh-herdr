// Per-task isolated worktrees.
//
// A delegation can run in a fresh `git worktree` instead of the user's dirty
// checkout. The branch is named after the task, the path lives under the DSH
// home, and nothing is merged automatically: the result carries the path so a
// human (or DSH) can review and merge deliberately.

import { basename, posix, resolve } from "node:path";
import { HerdrError } from "../domain/errors.js";
import type { WorktreeInfo } from "../domain/types.js";
import { joinFor } from "../domain/paths.js";
import type { MachineRuntimePool } from "../ports/machine.js";

export interface WorktreeDeps {
  runtimes: MachineRuntimePool;
}

export class WorktreeService {
  constructor(private readonly deps: WorktreeDeps) {}

  async create(input: {
    repoCwd: string;
    taskId: string;
    machine?: string;
  }): Promise<WorktreeInfo> {
    const runtime = await this.deps.runtimes.resolve(input.machine);
    const repo = runtime.remote ? input.repoCwd : resolve(input.repoCwd);
    if (!(await runtime.git.isRepo(repo))) {
      throw new HerdrError("VALIDATION_ERROR", "isolated:true needs a git repository at cwd", {
        remediation: "run the delegation in a git repo, or omit isolated",
      });
    }

    const repoName = (runtime.remote ? posix.basename(repo) : basename(repo)) || "repo";
    const path = joinFor(runtime, runtime.worktreesRoot, `${repoName}-${input.taskId}`);
    const branch = `dsh/${input.taskId}`;
    await runtime.io.mkdirp(runtime.worktreesRoot);

    await runtime.git.createWorktree({ repoCwd: repo, path, branch, base: "HEAD" });
    return { path, branch, repo, base: "HEAD" };
  }

  async remove(info: WorktreeInfo, force = false, machine?: string): Promise<void> {
    const runtime = await this.deps.runtimes.resolve(machine);
    await runtime.git.removeWorktree({ repoCwd: info.repo, path: info.path, force });
  }
}
