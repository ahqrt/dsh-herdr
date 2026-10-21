import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { homedir } from "node:os";
export class LocalMachineIo {
    async home() {
        return homedir();
    }
    async readText(path) {
        try {
            return readFileSync(path, "utf8");
        }
        catch (error) {
            if (isMissing(error))
                return undefined;
            throw error;
        }
    }
    async writeText(path, text) {
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, text, "utf8");
    }
    async mtime(path) {
        try {
            return statSync(path).mtimeMs;
        }
        catch {
            return 0;
        }
    }
    async mkdirp(path) {
        mkdirSync(path, { recursive: true });
    }
    exec(command, options = {}) {
        return new Promise((resolve) => {
            const child = execFile("sh", ["-lc", command], {
                timeout: options.timeoutMs ?? 60_000,
                maxBuffer: 16 * 1024 * 1024,
                signal: options.signal,
                windowsHide: true,
            }, (error, stdout, stderr) => {
                const code = error && typeof error.code === "number"
                    ? error.code
                    : error
                        ? 1
                        : 0;
                resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
            });
            if (options.stdin !== undefined) {
                child.stdin?.end(options.stdin);
            }
        });
    }
}
function isMissing(error) {
    return Boolean(error && typeof error === "object" && error.code === "ENOENT");
}
//# sourceMappingURL=local-io.js.map