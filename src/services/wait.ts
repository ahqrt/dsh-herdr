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
  const budget = Math.max(5_000, timeoutMs);
  try {
    await transport.waitForAgent(
      target,
      { until: ["idle", "done", "blocked"], timeoutMs: budget },
      signal,
    );
  } catch (error) {
    if (error instanceof HerdrError) {
      if (error.code === "ABORTED") throw error;
      if (error.code === "AGENT_NOT_FOUND" || error.code === "PANE_GONE") return "gone";
      if (error.code !== "TIMEOUT") throw error;
    } else {
      throw error;
    }
  }

  const agent = await transport.getAgent(target, signal);
  if (!agent) return "gone";
  return agent.status ?? "unknown";
}
