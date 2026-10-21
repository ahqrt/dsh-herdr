import { HerdrError } from "../domain/errors.js";
import type { PluginConfig } from "../defaults.js";
import type { HerdrTransport } from "../ports/transport.js";
import type { TransportPool } from "../ports/transports.js";

export class MachineTransportPool implements TransportPool {
  private readonly cache = new Map<string, HerdrTransport>();

  constructor(
    private readonly localTransport: HerdrTransport,
    private readonly config: PluginConfig,
    private readonly factory: (machine: string) => HerdrTransport,
  ) {}

  local(): HerdrTransport {
    return this.localTransport;
  }

  resolve(machine?: string): HerdrTransport {
    if (!machine || machine === "local") return this.localTransport;
    if (!this.config.machines.includes(machine)) {
      throw new HerdrError(
        "VALIDATION_ERROR",
        `machine "${machine}" is not enabled in the plugin config`,
        {
          remediation: `add it to machines: [${this.config.machines.map((entry) => `"${entry}"`).join(", ")}]`,
        },
      );
    }
    let transport = this.cache.get(machine);
    if (!transport) {
      transport = this.factory(machine);
      this.cache.set(machine, transport);
    }
    return transport;
  }

  machines(): string[] {
    return [...this.config.machines];
  }

  sharesFilesystem(machine: string): boolean {
    return this.config.sharedFilesystem.includes(machine);
  }
}
