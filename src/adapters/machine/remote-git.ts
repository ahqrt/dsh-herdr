// GitService over SSH. Commands run on the remote host; the patch itself is
// written locally so the reviewer can open it without a mount.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { HerdrError } from "../../domain/errors.js";
import type { DiffEvidence, GitBaseline } from "../../domain/types.js";
import type { CommandResult, MachineIo } from "../../ports/machine.js";
import type { GitDiffInput, GitService } from "../../ports/store.js";
import { shellQuote } from "./ssh-io.js";

export class RemoteGit implements GitService {
  constructor(private readonly io: MachineIo) {}

  async isRepo(cwd: string): Promise<boolean> {
    const result = await this.git(cwd, ["rev-parse", "--is-inside-work-tree"], 10_000);
    return result.code === 0 && result.stdout.trim() === "true";
  }

  async baseline(cwd: string): Promise<GitBaseline | undefined> {
    if (!(await this.isRepo(cwd))) return undefined;
    const head = await this.git(cwd, ["rev-parse", "HEAD"]);
    const status = await this.git(cwd, ["status", "--porcelain"]);
    return {
      head: head.code === 0 ? head.stdout.trim() : undefined,
      dirty: status.code === 0 ? status.stdout.split(/\r?\n/).filter(Boolean) : [],
    };
  }

  async diff(input: GitDiffInput): Promise<DiffEvidence | undefined> {
    if (!(await this.isRepo(input.cwd))) return undefined;
    const range = input.baseline?.head ? [input.baseline.head] : [];
    const stat = await this.git(input.cwd, ["diff", "--stat", ...range], 30_000);
    const patch = await this.git(input.cwd, ["diff", ...range], 60_000);
    const status = await this.git(input.cwd, ["status", "--porcelain"], 20_000);

    const statusLines = status.code === 0 ? status.stdout.split(/\r?\n/).filter(Boolean) : [];
    const untracked = statusLines
      .filter((line) => line.startsWith("?? "))
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
    const files = statusLines
      .map((line) =>
        line
          .slice(3)
          .trim()
          .replace(/^.* -> /, ""),
      )
      .filter(Boolean);

    let text = patch.code === 0 ? patch.stdout : "";
    let truncated = false;
    if (text.length > input.maxBytes) {
      text = `${text.slice(0, input.maxBytes)}\n\n[patch truncated at ${input.maxBytes} bytes]`;
      truncated = true;
    }
    if (untracked.length > 0) {
      text += `\n\n[untracked files not included in the patch]\n${untracked.join("\n")}\n`;
    }

    try {
      mkdirSync(dirname(input.patchPath), { recursive: true });
      writeFileSync(input.patchPath, text, "utf8");
    } catch {
      /* the patch is optional evidence */
    }

    return {
      baselineHead: input.baseline?.head,
      stat: stat.code === 0 ? stat.stdout.trim() : "",
      files: [...new Set(files)],
      untracked,
      patchPath: input.patchPath,
      patchBytes: text.length,
      truncated,
      dirtyAtStart: input.baseline?.dirty ?? [],
    };
  }

  async status(cwd: string): Promise<string[]> {
    const result = await this.git(cwd, ["status", "--porcelain"], 20_000);
    return result.code === 0 ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
  }

  async createWorktree(input: {
    repoCwd: string;
    path: string;
    branch: string;
    base?: string;
  }): Promise<void> {
    const result = await this.git(
      input.repoCwd,
      ["worktree", "add", "-b", input.branch, input.path, input.base ?? "HEAD"],
      120_000,
    );
    if (result.code !== 0) {
      throw new HerdrError(
        "VALIDATION_ERROR",
        `remote git worktree add failed: ${result.stderr.trim()}`,
        {
          remediation: "check that the branch name is free and the remote repository has a commit",
        },
      );
    }
  }

  async removeWorktree(input: { repoCwd: string; path: string; force?: boolean }): Promise<void> {
    const args = ["worktree", "remove", input.path];
    if (input.force) args.push("--force");
    const result = await this.git(input.repoCwd, args, 60_000);
    if (result.code !== 0) {
      throw new HerdrError(
        "VALIDATION_ERROR",
        `remote git worktree remove failed: ${result.stderr.trim()}`,
        {
          remediation: "commit or discard the worktree's changes, or pass force:true",
        },
      );
    }
  }

  private git(cwd: string, args: string[], timeoutMs = 15_000): Promise<CommandResult> {
    const command = `git -C ${shellQuote(cwd)} ${args.map(shellQuote).join(" ")}`;
    return this.io.exec(command, { timeoutMs });
  }
}
