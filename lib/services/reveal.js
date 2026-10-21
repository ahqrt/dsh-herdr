// Reveal an owned task's cwd in the OS file manager, or open it in a configured
// editor. The path always comes from the task record, never from the request
// body; the editor command comes from trusted plugin config and is spawned with
// argv, never through a shell.
import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { HerdrError } from "../domain/errors.js";
export class RevealService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    editorEnabled() {
        return Boolean(this.deps.editor?.command);
    }
    async reveal(target) {
        const cwd = await this.ownedDirectory(target);
        await (this.deps.opener ?? openInFileManager)(cwd, this.deps.platform ?? process.platform);
        return { revealed: true, cwd, message: `revealed ${cwd} in the file manager` };
    }
    async openEditor(target) {
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
    async ownedDirectory(target) {
        const record = await this.deps.store.find(target);
        if (!record) {
            throw new HerdrError("TASK_NOT_OWNED", `refusing to open "${target}": not spawned by this plugin`);
        }
        if (!record.cwd) {
            throw new HerdrError("VALIDATION_ERROR", `task ${record.taskId} has no cwd`);
        }
        const info = await stat(record.cwd).catch(() => undefined);
        if (!info?.isDirectory()) {
            throw new HerdrError("VALIDATION_ERROR", `cwd no longer exists or is not a directory: ${record.cwd}`);
        }
        return record.cwd;
    }
}
/** Best-effort native opener; detached and ignored, never shell-interpolated. */
export function openInFileManager(path, platform = process.platform) {
    const command = platform === "darwin" ? "open" : platform === "win32" ? "explorer.exe" : "xdg-open";
    return launch(command, [path]);
}
/** Launch a configured editor with argv; no shell, detached, ignored. */
export function openInEditor(command, args, cwd) {
    return launch(command, [...args, cwd]);
}
function launch(command, args) {
    return new Promise((resolve, reject) => {
        try {
            const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
            child.on("error", reject);
            child.unref();
            resolve();
        }
        catch (error) {
            reject(error);
        }
    });
}
//# sourceMappingURL=reveal.js.map