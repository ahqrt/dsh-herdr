// Reveal an owned task's cwd in the OS file manager.
//
// The path always comes from the task record, never from the request body, and
// the record must exist in this plugin's store. The opener is injectable so
// tests never launch Finder/Explorer.

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { HerdrError } from "../domain/errors.js";
import type { TaskStore } from "../ports/store.js";

export interface RevealDeps {
  store: TaskStore;
  /** Override for tests. */
  opener?: (path: string) => Promise<void>;
  platform?: NodeJS.Platform;
}

export interface RevealResult {
  revealed: true;
  cwd: string;
  message: string;
}

export class RevealService {
  constructor(private readonly deps: RevealDeps) {}

  async reveal(target: string): Promise<RevealResult> {
    const record = await this.deps.store.find(target);
    if (!record) {
      throw new HerdrError(
        "TASK_NOT_OWNED",
        `refusing to reveal "${target}": not spawned by this plugin`,
      );
    }
    if (!record.cwd) {
      throw new HerdrError("VALIDATION_ERROR", `task ${record.taskId} has no cwd`);
    }
    const info = await stat(record.cwd).catch(() => undefined);
    if (!info?.isDirectory()) {
      throw new HerdrError(
        "VALIDATION_ERROR",
        `cwd no longer exists or is not a directory: ${record.cwd}`,
      );
    }
    await (this.deps.opener ?? openInFileManager)(
      record.cwd,
      this.deps.platform ?? process.platform,
    );
    return {
      revealed: true,
      cwd: record.cwd,
      message: `revealed ${record.cwd} in the file manager`,
    };
  }
}

/** Best-effort native opener; detached and ignored, never shell-interpolated. */
export function openInFileManager(
  path: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "explorer.exe" : "xdg-open";
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, [path], { detached: true, stdio: "ignore", windowsHide: true });
      child.on("error", reject);
      child.unref();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
