import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { HerdrError } from "../../domain/errors.js";
import type { CommandOptions, CommandResult, MachineIo } from "../../ports/machine.js";

export class LocalMachineIo implements MachineIo {
  async home(): Promise<string> {
    return homedir();
  }

  async readText(path: string): Promise<string | undefined> {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async writeText(path: string, text: string): Promise<void> {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  }

  async mtime(path: string): Promise<number> {
    try {
      return statSync(path).mtimeMs;
    } catch {
      return 0;
    }
  }

  async mkdirp(path: string): Promise<void> {
    mkdirSync(path, { recursive: true });
  }

  exec(command: string, options: CommandOptions = {}): Promise<CommandResult> {
    return new Promise((resolve) => {
      const child = execFile(
        "sh",
        ["-lc", command],
        {
          timeout: options.timeoutMs ?? 60_000,
          maxBuffer: 16 * 1024 * 1024,
          signal: options.signal,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          const code =
            error && typeof (error as { code?: unknown }).code === "number"
              ? (error as { code: number }).code
              : error
                ? 1
                : 0;
          resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
        },
      );
      if (options.stdin !== undefined) {
        child.stdin?.end(options.stdin);
      }
    });
  }
}

function isMissing(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && (error as NodeJS.ErrnoException).code === "ENOENT",
  );
}
