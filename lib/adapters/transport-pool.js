import { HerdrError } from "../domain/errors.js";
export class MachineTransportPool {
    localTransport;
    config;
    factory;
    cache = new Map();
    constructor(localTransport, config, factory) {
        this.localTransport = localTransport;
        this.config = config;
        this.factory = factory;
    }
    local() {
        return this.localTransport;
    }
    resolve(machine) {
        if (!machine || machine === "local")
            return this.localTransport;
        if (!this.config.machines.includes(machine)) {
            throw new HerdrError("VALIDATION_ERROR", `machine "${machine}" is not enabled in the plugin config`, {
                remediation: `add it to machines: [${this.config.machines.map((entry) => `"${entry}"`).join(", ")}]`,
            });
        }
        let transport = this.cache.get(machine);
        if (!transport) {
            transport = this.factory(machine);
            this.cache.set(machine, transport);
        }
        return transport;
    }
    machines() {
        return [...this.config.machines];
    }
    sharesFilesystem(machine) {
        return this.config.sharedFilesystem.includes(machine);
    }
}
//# sourceMappingURL=transport-pool.js.map