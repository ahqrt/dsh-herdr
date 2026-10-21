// SSH-backed MachineIo. Every operation runs one `ssh <target> sh -lc <cmd>`
// command; stdin is used for writes so paths never need shell interpolation of
// file contents. No mount, no rsync.
import { spawn } from "node:child_process";
import { HerdrError } from "../../domain/errors.js";
/** POSIX single-quote escaping. */
export function shellQuote(value) {
    if (value === "")
        return "''";
    return `'${value.replaceAll("'", `'\\''`)}'`;
}
export class SshMachineIo {
    options;
    homeCache;
    constructor(options) {
        this.options = options;
    }
    async home() {
        if (this.homeCache)
            return this.homeCache;
        const result = await this.exec('printf %s "$HOME"');
        if (result.code !== 0 || !result.stdout.trim()) {
            throw new HerdrError("HERDR_UNAVAILABLE", `cannot read $HOME on ${this.options.target}: ${result.stderr.trim() || "empty response"}`, { remediation: "check SSH access and that the remote shell is POSIX" });
        }
        this.homeCache = result.stdout.trim();
        return this.homeCache;
    }
    async readText(path) {
        const result = await this.exec(`cat ${shellQuote(path)}`);
        if (result.code === 0)
            return result.stdout;
        if (isMissing(result.stderr))
            return undefined;
        throw new HerdrError("HERDR_UNAVAILABLE", `cannot read ${path} on ${this.options.target}: ${result.stderr.trim()}`);
    }
    async writeText(path, text) {
        const result = await this.exec(`cat > ${shellQuote(path)}`, { stdin: text });
        if (result.code !== 0) {
            throw new HerdrError("HERDR_UNAVAILABLE", `cannot write ${path} on ${this.options.target}: ${result.stderr.trim()}`);
        }
    }
    async mtime(path) {
        const result = await this.exec(`stat -c %Y ${shellQuote(path)} 2>/dev/null || stat -f %m ${shellQuote(path)} 2>/dev/null`);
        if (result.code !== 0)
            return 0;
        const seconds = Number(result.stdout.trim());
        return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
    }
    async mkdirp(path) {
        const result = await this.exec(`mkdir -p ${shellQuote(path)}`);
        if (result.code !== 0) {
            throw new HerdrError("HERDR_UNAVAILABLE", `cannot create ${path} on ${this.options.target}: ${result.stderr.trim()}`);
        }
    }
    exec(command, options = {}) {
        const timeoutMs = options.timeoutMs ?? this.options.defaultTimeoutMs ?? 120_000;
        const ssh = this.options.sshBin ?? "ssh";
        const args = [
            "-o",
            "BatchMode=yes",
            "-o",
            `ConnectTimeout=${this.options.connectTimeoutSec ?? 15}`,
            this.options.target,
            "sh",
            "-lc",
            command,
        ];
        return new Promise((resolve, reject) => {
            let settled = false;
            const child = spawn(ssh, args, {
                env: this.options.env ?? process.env,
                windowsHide: true,
                stdio: ["pipe", "pipe", "pipe"],
            });
            let stdout = "";
            let stderr = "";
            let timer;
            const onAbort = () => {
                try {
                    child.kill("SIGTERM");
                }
                catch {
                    /* already gone */
                }
                finish(() => reject(new HerdrError("ABORTED", `ssh ${this.options.target} aborted`)));
            };
            const finish = (action) => {
                if (settled)
                    return;
                settled = true;
                if (timer)
                    clearTimeout(timer);
                options.signal?.removeEventListener("abort", onAbort);
                action();
            };
            timer = setTimeout(() => {
                try {
                    child.kill("SIGTERM");
                }
                catch {
                    /* already gone */
                }
                finish(() => reject(new HerdrError("TIMEOUT", `ssh ${this.options.target} timed out after ${timeoutMs}ms`, {
                    remediation: "retry with a larger timeout, or check the SSH connection",
                })));
            }, timeoutMs);
            if (options.signal) {
                if (options.signal.aborted) {
                    onAbort();
                    return;
                }
                options.signal.addEventListener("abort", onAbort, { once: true });
            }
            child.stdout?.on("data", (chunk) => {
                stdout += String(chunk);
            });
            child.stderr?.on("data", (chunk) => {
                stderr += String(chunk);
            });
            child.on("error", (error) => {
                const code = error.code;
                finish(() => reject(new HerdrError(code === "ENOENT" ? "HERDR_UNAVAILABLE" : "HERDR_UNAVAILABLE", code === "ENOENT"
                    ? "ssh binary not found on PATH"
                    : `failed to run ssh: ${error.message}`)));
            });
            child.on("close", (code) => {
                finish(() => resolve({ code: code ?? 1, stdout, stderr }));
            });
            if (options.stdin !== undefined)
                child.stdin?.end(options.stdin);
            else
                child.stdin?.end();
        });
    }
}
function isMissing(stderr) {
    return /no such file|not found|cannot access|does not exist/i.test(stderr);
}
//# sourceMappingURL=ssh-io.js.map