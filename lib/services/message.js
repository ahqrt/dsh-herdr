// Messaging a live Herdr agent: review findings back to a worker, an answer
// to a blocked agent, or a plain follow-up.
import { HerdrError } from "../domain/errors.js";
import { buildAgentMessage, buildReviewFindings } from "../domain/prompt.js";
export class MessageService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async send(input) {
        const { transport, store, audit } = this.deps;
        const record = await store.find(input.target);
        const target = record?.name ?? input.target;
        const body = input.kind === "REVIEW_FINDINGS"
            ? buildReviewFindings(input.message, input.round ?? 1)
            : input.kind && input.kind !== "ANSWER"
                ? `${input.kind}\n${input.message.trim()}`
                : input.message;
        const envelope = buildAgentMessage({
            from: "dsh:orchestrator",
            to: target,
            text: body,
        });
        const outcome = await transport.promptAgent(target, envelope, {
            wait: input.wait === true,
            timeoutMs: Math.min(Math.max(input.timeoutMs ?? 600_000, 10_000), 3_600_000),
            until: ["idle", "done", "blocked"],
        }, input.signal);
        if (outcome === "stalled") {
            throw new HerdrError("AGENT_STALLED", `message was written to ${target} but no turn started`, { remediation: "inspect the pane with herdr_list_agents; the message may have been lost" });
        }
        const agent = await transport
            .getAgent(target, input.signal)
            .catch(() => undefined);
        const status = agent?.status;
        if (record) {
            await store.update(record.taskId, {
                status: outcome === "blocked" ? "blocked" : status === "working" ? "working" : record.status,
                updatedAt: Date.now(),
            });
        }
        audit.write({ event: "message", target, kind: input.kind, outcome, status });
        return {
            delivered: true,
            startedTurn: outcome !== "timeout",
            status,
            target,
            message: outcome === "blocked"
                ? `delivered to ${target}; the agent is blocked on a further question`
                : outcome === "timeout"
                    ? `delivered to ${target}; it did not settle before the timeout (status: ${status ?? "unknown"})`
                    : `delivered to ${target}; agent status: ${status ?? "unknown"}`,
        };
    }
}
//# sourceMappingURL=message.js.map