import type { CommandOptions, CommandResult, MachineIo } from "../../ports/machine.js";
export interface SshIoOptions {
    target: string;
    sshBin?: string;
    env?: NodeJS.ProcessEnv;
    connectTimeoutSec?: number;
    /** Per-call timeout when the caller does not supply one. */
    defaultTimeoutMs?: number;
}
/** POSIX single-quote escaping. */
export declare function shellQuote(value: string): string;
export declare class SshMachineIo implements MachineIo {
    private readonly options;
    private homeCache;
    constructor(options: SshIoOptions);
    home(): Promise<string>;
    readText(path: string): Promise<string | undefined>;
    writeText(path: string, text: string): Promise<void>;
    mtime(path: string): Promise<number>;
    mkdirp(path: string): Promise<void>;
    exec(command: string, options?: CommandOptions): Promise<CommandResult>;
}
//# sourceMappingURL=ssh-io.d.ts.map