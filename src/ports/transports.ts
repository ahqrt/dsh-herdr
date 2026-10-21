// Per-machine transport selection. The local machine can use the socket or
// CLI; remote machines always use the CLI's `--machine` forwarding.

import type { HerdrTransport } from "./transport.js";

export interface TransportPool {
  local(): HerdrTransport;
  /** `undefined` / `"local"` resolves to the local transport. */
  resolve(machine?: string): HerdrTransport;
  machines(): string[];
  /** True when the machine's filesystem is mounted locally (spawn needs it). */
  sharesFilesystem(machine: string): boolean;
}
