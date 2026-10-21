import type { Paths } from "../../domain/paths.js";
import type { PluginConfig } from "../../defaults.js";
import type { MachineRuntime, MachineRuntimePool as MachineRuntimePoolPort } from "../../ports/machine.js";
import type { GitService } from "../../ports/store.js";
import { LocalMachineIo } from "./local-io.js";
export interface RuntimePoolDeps {
    config: PluginConfig;
    paths: Paths;
    localGit: GitService;
    localIo?: LocalMachineIo;
    sshBin?: string;
    env?: NodeJS.ProcessEnv;
}
/** Parse `label=user@host` entries; labels may not contain `=`. */
export declare function parseMachineTargets(entries: string[]): Map<string, string>;
export declare class MachineRuntimePool implements MachineRuntimePoolPort {
    private readonly deps;
    private readonly cache;
    private readonly targets;
    constructor(deps: RuntimePoolDeps);
    local(): Promise<MachineRuntime>;
    resolve(machine?: string): Promise<MachineRuntime>;
    machines(): string[];
    sharesFilesystem(machine: string): boolean;
    hasRemoteTarget(machine: string): boolean;
    private getLocal;
    private createRemote;
}
//# sourceMappingURL=runtime-pool.d.ts.map