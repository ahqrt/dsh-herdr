import type { CommandOptions, CommandResult, MachineIo } from "../../ports/machine.js";
export declare class LocalMachineIo implements MachineIo {
    home(): Promise<string>;
    readText(path: string): Promise<string | undefined>;
    writeText(path: string, text: string): Promise<void>;
    mtime(path: string): Promise<number>;
    mkdirp(path: string): Promise<void>;
    exec(command: string, options?: CommandOptions): Promise<CommandResult>;
}
//# sourceMappingURL=local-io.d.ts.map