// One runtime per machine: file access, git, and artifact roots.
//
// - local: node:fs + LocalGit, absolute config paths;
// - shared filesystem: local IO against the mounted paths;
// - SSH target: SshMachineIo + RemoteGit, roots under the remote $HOME.
import { homedir } from "node:os";
import { posix } from "node:path";
import { HerdrError } from "../../domain/errors.js";
import { LocalMachineIo } from "./local-io.js";
import { RemoteGit } from "./remote-git.js";
import { SshMachineIo } from "./ssh-io.js";
/** Parse `label=user@host` entries; labels may not contain `=`. */
export function parseMachineTargets(entries) {
    const targets = new Map();
    for (const entry of entries) {
        const index = entry.indexOf("=");
        if (index <= 0 || index === entry.length - 1) {
            throw new HerdrError("VALIDATION_ERROR", `invalid machineTargets entry "${entry}"; expected label=ssh-target`);
        }
        const label = entry.slice(0, index).trim();
        const target = entry.slice(index + 1).trim();
        if (!label || !target || /\s/.test(target)) {
            throw new HerdrError("VALIDATION_ERROR", `invalid machineTargets entry "${entry}"; the SSH target must be a single destination such as user@host`);
        }
        targets.set(label, target);
    }
    return targets;
}
export class MachineRuntimePool {
    deps;
    cache = new Map();
    targets;
    constructor(deps) {
        this.deps = deps;
        this.targets = parseMachineTargets(deps.config.machineTargets);
    }
    local() {
        return this.getLocal();
    }
    resolve(machine) {
        if (!machine || machine === "local")
            return this.getLocal();
        if (!this.deps.config.machines.includes(machine)) {
            throw new HerdrError("VALIDATION_ERROR", `machine "${machine}" is not enabled in the plugin config`, {
                remediation: `add it to machines: [${this.deps.config.machines.map((entry) => `"${entry}"`).join(", ")}]`,
            });
        }
        let runtime = this.cache.get(machine);
        if (!runtime) {
            runtime = this.createRemote(machine);
            this.cache.set(machine, runtime);
        }
        return runtime;
    }
    machines() {
        return [...this.deps.config.machines];
    }
    sharesFilesystem(machine) {
        return this.deps.config.sharedFilesystem.includes(machine);
    }
    hasRemoteTarget(machine) {
        return this.targets.has(machine);
    }
    getLocal() {
        let runtime = this.cache.get("local");
        if (!runtime) {
            runtime = Promise.resolve({
                io: this.deps.localIo ?? new LocalMachineIo(),
                git: this.deps.localGit,
                artifactsRoot: this.deps.paths.artifactsRoot,
                worktreesRoot: this.deps.paths.worktreesRoot,
                home: homedir(),
                remote: false,
            });
            this.cache.set("local", runtime);
        }
        return runtime;
    }
    async createRemote(machine) {
        const target = this.targets.get(machine);
        if (!target) {
            if (this.deps.config.sharedFilesystem.includes(machine)) {
                return {
                    machine,
                    io: this.deps.localIo ?? new LocalMachineIo(),
                    git: this.deps.localGit,
                    artifactsRoot: this.deps.paths.artifactsRoot,
                    worktreesRoot: this.deps.paths.worktreesRoot,
                    home: homedir(),
                    remote: false,
                };
            }
            throw new HerdrError("VALIDATION_ERROR", `machine "${machine}" has no file access configured`, {
                remediation: `add machineTargets: ["${machine}=user@host"] for SSH, or list it in sharedFilesystem if its filesystem is mounted`,
            });
        }
        const io = new SshMachineIo({
            target,
            sshBin: this.deps.sshBin,
            env: this.deps.env,
        });
        const home = await io.home();
        const base = remoteBase(this.deps.config.remoteHomeDir, home);
        return {
            machine,
            io,
            git: new RemoteGit(io),
            artifactsRoot: posix.join(base, "tasks"),
            worktreesRoot: posix.join(base, "worktrees"),
            home,
            remote: true,
        };
    }
}
function remoteBase(template, home) {
    const value = template.trim() || "~/.dsh/herdr";
    if (value === "~")
        return home;
    if (value.startsWith("~/"))
        return posix.join(home, value.slice(2));
    if (value.startsWith("/"))
        return value;
    return posix.join(home, value);
}
//# sourceMappingURL=runtime-pool.js.map