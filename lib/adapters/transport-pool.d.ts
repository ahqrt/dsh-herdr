import type { PluginConfig } from "../defaults.js";
import type { HerdrTransport } from "../ports/transport.js";
import type { TransportPool } from "../ports/transports.js";
export declare class MachineTransportPool implements TransportPool {
    private readonly localTransport;
    private readonly config;
    private readonly factory;
    private readonly cache;
    constructor(localTransport: HerdrTransport, config: PluginConfig, factory: (machine: string) => HerdrTransport);
    local(): HerdrTransport;
    resolve(machine?: string): HerdrTransport;
    machines(): string[];
    sharesFilesystem(machine: string): boolean;
}
//# sourceMappingURL=transport-pool.d.ts.map