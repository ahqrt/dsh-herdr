// Poll until an agent settles, bounded by a caller timeout. Herdr's event
// wait is preferred for the prompt itself; this is the follow-up path
// (`herdr_get_agent_result(wait:true)`) and survives a missed state event.

import { HerdrError } from "../domain/errors.js";
import type { HerdrAgentStatus } from "../domain/types.js";
import type { HerdrTransport } from "../ports/transport.js";

export type SettleState = HerdrAgentStatus | "gone";

export async function waitForSettle(
  transport: HerdrTransport,
  target: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<SettleState> {
  const deadline = Date.now() + Math.max(5_000, timeoutMs);
  let last: HerdrAgentStatus | undefined;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new HerdrError("ABORTED", "the wait was cancelled");
    }
    const agent = await transport.getAgent(target, signal);
    if (!agent) return "gone";
    if (agent.status) last = agent.status;
    if (agent.status === "idle" || agent.status === "done" || agent.status === "blocked") {
      return agent.status;
    }
    await sleep(700);
  }
  return last ?? "unknown";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}
