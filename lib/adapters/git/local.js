// Git evidence for review: a baseline at spawn, a patch at harvest.
// Kept behind a port so tests can run against a temp repo (or a fake).
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { HerdrError } from "../../domain/errors.js";
function runGit(cwd, args, timeoutMs = 15_000) {
    return new Promise((resolve) => {
        execFile("git", ["-C", cwd, ...args], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
            resolve({
                ok: !error,
                stdout: String(stdout ?? ""),
                stderr: String(stderr ?? ""),
            });
        });
    });
}
export class LocalGit {
    async isRepo(cwd) {
        if (!existsSync(cwd))
            return false;
        const result = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"], 5_000);
        return result.ok && result.stdout.trim() === "true";
    }
    async baseline(cwd) {
        if (!(await this.isRepo(cwd)))
            return undefined;
        const head = await runGit(cwd, ["rev-parse", "HEAD"]);
        const status = await runGit(cwd, ["status", "--porcelain"]);
        return {
            head: head.ok ? head.stdout.trim() : undefined,
            dirty: status.ok ? status.stdout.split(/\r?\n/).filter(Boolean) : [],
        };
    }
    async diff(input) {
        const { cwd, baseline, patchPath } = input;
        if (!(await this.isRepo(cwd)))
            return undefined;
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
            .map((line) => line
            .slice(3)
            .trim()
            .replace(/^.* -> /, ""))
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
        }
        catch {
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
    async status(cwd) {
        const result = await runGit(cwd, ["status", "--porcelain"], 5_000);
        return result.ok ? result.stdout.split(/\r?\n/).filter(Boolean) : [];
    }
    async createWorktree(input) {
        const result = await runGit(input.repoCwd, ["worktree", "add", "-b", input.branch, input.path, input.base ?? "HEAD"], 60_000);
        if (!result.ok) {
            throw new HerdrError("VALIDATION_ERROR", `git worktree add failed: ${result.stderr.trim()}`, {
                remediation: "check that the branch name is free and the repository has a commit",
            });
        }
    }
    async removeWorktree(input) {
        const args = ["worktree", "remove", input.path];
        if (input.force)
            args.push("--force");
        const result = await runGit(input.repoCwd, args, 30_000);
        if (!result.ok) {
            throw new HerdrError("VALIDATION_ERROR", `git worktree remove failed: ${result.stderr.trim()}`, {
                remediation: "commit or discard the worktree's changes, or pass force:true",
            });
        }
    }
}
//# sourceMappingURL=local.js.map