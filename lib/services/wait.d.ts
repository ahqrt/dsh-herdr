import type { HerdrAgentStatus } from "../domain/types.js";
import type { HerdrTransport } from "../ports/transport.js";
export type SettleState = HerdrAgentStatus | "gone";
export declare function waitForSettle(transport: HerdrTransport, target: string, timeoutMs: number, signal?: AbortSignal): Promise<SettleState>;
//# sourceMappingURL=wait.d.ts.map