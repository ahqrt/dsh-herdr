export interface CommandResult {
    code: number;
    stdout: string;
    stderr: string;
}
export interface CommandOptions {
    stdin?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
}
export interface MachineIo {
    /** Absolute home directory on the machine (POSIX for remote). */
    home(): Promise<string>;
    readText(path: string): Promise<string | undefined>;
    writeText(path: string, text: string): Promise<void>;
    mtime(path: string): Promise<number>;
    mkdirp(path: string): Promise<void>;
    exec(command: string, options?: CommandOptions): Promise<CommandResult>;
}
export interface MachineRuntime {
    /** Absent for the local machine. */
    machine?: string;
    io: MachineIo;
    git: import("./store.js").GitService;
    artifactsRoot: string;
    worktreesRoot: string;
    home: string;
    /** True when this runtime reads the remote filesystem over SSH. */
    remote: boolean;
}
export interface MachineRuntimePool {
    local(): Promise<MachineRuntime>;
    resolve(machine?: string): Promise<MachineRuntime>;
    machines(): string[];
    sharesFilesystem(machine: string): boolean;
    hasRemoteTarget(machine: string): boolean;
}
//# sourceMappingURL=machine.d.ts.map