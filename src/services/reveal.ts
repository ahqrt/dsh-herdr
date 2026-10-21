// Reveal an owned task's cwd in the OS file manager, or open it in a configured
// editor. The path always comes from the task record, never from the request
// body; the editor command comes from trusted plugin config and is spawned with
// argv, never through a shell.

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { HerdrError } from "../domain/errors.js";
import type { TaskStore } from "../ports/store.js";

export interface RevealDeps {
  store: TaskStore;
  /** Empty disables the panel's "open editor" action. */
  editor?: { command: string; args: string[] };
  /** Overrides for tests. */
  opener?: (path: string) => Promise<void>;
  editorOpener?: (command: string, args: string[], cwd: string) => Promise<void>;
  platform?: NodeJS.Platform;
}

export interface RevealResult {
  revealed: true;
  cwd: string;
  message: string;
}

export class RevealService {
  constructor(private readonly deps: RevealDeps) {}

  editorEnabled(): boolean {
    return Boolean(this.deps.editor?.command);
  }

  async reveal(target: string): Promise<RevealResult> {
    const cwd = await this.ownedDirectory(target);
    await (this.deps.opener ?? openInFileManager)(cwd, this.deps.platform ?? process.platform);
    return { revealed: true, cwd, message: `revealed ${cwd} in the file manager` };
  }

  async openEditor(target: string): Promise<RevealResult> {
    const cwd = await this.ownedDirectory(target);
    const editor = this.deps.editor;
    if (!editor?.command) {
      throw new HerdrError("VALIDATION_ERROR", "editorCommand is not configured", {
        remediation: 'set editorCommand (for example "code") and optional editorArgs',
      });
    }
    await (this.deps.editorOpener ?? openInEditor)(editor.command, editor.args, cwd);
    return { revealed: true, cwd, message: `opened ${cwd} in ${editor.command}` };
  }

  private async ownedDirectory(target: string): Promise<string> {
    const record = await this.deps.store.find(target);
    if (!record) {
      throw new HerdrError(
        "TASK_NOT_OWNED",
        `refusing to open "${target}": not spawned by this plugin`,
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
    return record.cwd;
  }
}

/** Best-effort native opener; detached and ignored, never shell-interpolated. */
export function openInFileManager(
  path: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const command =
    platform === "darwin" ? "open" : platform === "win32" ? "explorer.exe" : "xdg-open";
  return launch(command, [path]);
}

/** Launch a configured editor with argv; no shell, detached, ignored. */
export function openInEditor(command: string, args: string[], cwd: string): Promise<void> {
  return launch(command, [...args, cwd]);
}

function launch(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
      child.on("error", reject);
      child.unref();
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}
