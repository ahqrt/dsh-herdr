// Poll until an agent settles, bounded by a caller timeout. Herdr's event
// wait is preferred for the prompt itself; this is the follow-up path
// (`herdr_get_agent_result(wait:true)`) and survives a missed state event.
import { HerdrError } from "../domain/errors.js";
export async function waitForSettle(transport, target, timeoutMs, signal) {
    const deadline = Date.now() + Math.max(5_000, timeoutMs);
    let last;
    while (Date.now() < deadline) {
        if (signal?.aborted) {
            throw new HerdrError("ABORTED", "the wait was cancelled");
        }
        const agent = await transport.getAgent(target, signal);
        if (!agent)
            return "gone";
        if (agent.status)
            last = agent.status;
        if (agent.status === "idle" || agent.status === "done" || agent.status === "blocked") {
            return agent.status;
        }
        await sleep(700);
    }
    return last ?? "unknown";
}
function sleep(ms) {
    return new Promise((resolveSleep) => {
        const timer = setTimeout(resolveSleep, ms);
        timer.unref?.();
    });
}
//# sourceMappingURL=wait.js.map