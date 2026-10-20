// Git evidence for review: a baseline at spawn, a patch at harvest.
// Kept behind a port so tests can run against a temp repo (or a fake).

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { DiffEvidence, GitBaseline } from "../../domain/types.js";
import type { GitDiffInput, GitService } from "../../ports/store.js";

function runGit(cwd: string, args: string[], timeoutMs = 15_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      "git",
      ["-C", cwd, ...args],
      { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
        });
      },
    );
  });
}

export class LocalGit implements GitService {
  async isRepo(cwd: string): Promise<boolean> {
    if (!existsSync(cwd)) return false;
    const result = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"], 5_000);
    return result.ok && result.stdout.trim() === "true";
  }

  async baseline(cwd: string): Promise<GitBaseline | undefined> {
    if (!(await this.isRepo(cwd))) return undefined;
    const head = await runGit(cwd, ["rev-parse", "HEAD"]);
    const status = await runGit(cwd, ["status", "--porcelain"]);
    return {
      head: head.ok ? head.stdout.trim() : undefined,
      dirty: status.ok ? status.stdout.split(/\r?\n/).filter(Boolean) : [],
    };
  }

  async diff(input: GitDiffInput): Promise<DiffEvidence | undefined> {
    const { cwd, baseline, patchPath } = input;
    if (!(await this.isRepo(cwd))) return undefined;

    const range = baseline?.head ? [baseline.head] : [];
    const stat = await runGit(cwd, ["diff", "--stat", ...range]);
    const patch = await runGit(cwd, ["diff", ...range], 30_000);
    const status = await runGit(cwd, ["status", "--porcelain"]);

    const statusLines = status.ok ? status.stdout.split(/\r?\n/).filter(Boolean) : [];
    const untracked = statusLines
      .filter((line) => line.startsWith("?? "))
      .map((line) => line.slice(3).trim())
      .filter(Boolean);
    const files = statusLines
      .map((line) => line.slice(3).trim().replace(/^.* -> /, ""))
      .filter(Boolean);

    let text = patch.ok ? patch.stdout : "";
    let truncated = false;
    if (text.length > input.maxBytes) {
      text = `${text.slice(0, input.maxBytes)}\n\n[patch truncated at ${input.maxBytes} bytes]`;
      truncated = true;
    }
    if (untracked.length > 0) {
      text += `\n\n[untracked files not included in the patch]\n${untracked.join("\n")}\n`;
    }

    try {
      mkdirSync(dirname(patchPath), { recursive: true });
      writeFileSync(patchPath, text, "utf8");
    } catch {
      /* the patch is optional evidence; keep the metadata */
    }

    return {
      baselineHead: baseline?.head,
      stat: stat.ok ? stat.stdout.trim() : "",
      files: [...new Set(files)],
      untracked,
      patchPath,
      patchBytes: text.length,
      truncated,
      dirtyAtStart: baseline?.dirty ?? [],
    };
  }

  async status(cwd: string): Promise<string[]> {
    const result = await runGit(cwd, ["status", "--porcelain"], 5_000);
    return result.ok ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
  }
}
