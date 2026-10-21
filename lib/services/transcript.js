// Paged access to a child's pi session. `herdr_get_agent_result` gives the
// final message; this gives the turns that produced it.
import { HerdrError } from "../domain/errors.js";
import { readTranscriptFromText } from "../domain/transcript.js";
const MAX_MESSAGE_CHARS = 6_000;
export class TranscriptService {
    store;
    runtimes;
    constructor(store, runtimes) {
        this.store = store;
        this.runtimes = runtimes;
    }
    async read(input) {
        const record = await this.resolve(input.target);
        const sessionPath = record.sessionPath;
        const runtime = await this.runtimes.resolve(record.machine);
        const text = sessionPath ? await runtime.io.readText(sessionPath) : undefined;
        if (!sessionPath || text === undefined) {
            throw new HerdrError("NO_TRANSCRIPT", `task ${record.taskId} (${record.kind}) has no readable pi session file`, {
                remediation: "only kind=pi exposes a transcript; use herdr_get_agent_result for the pane-tail fallback",
            });
        }
        const all = readTranscriptFromText(text);
        const from = Math.max(0, Math.trunc(input.from ?? 0));
        const limit = Math.max(1, Math.min(100, Math.trunc(input.limit ?? 20)));
        const page = { messages: all.slice(from, from + limit), total: all.length };
        const messages = page.messages.map((message) => message.text.length > MAX_MESSAGE_CHARS
            ? {
                ...message,
                text: `${message.text.slice(0, MAX_MESSAGE_CHARS)}\n[message truncated]`,
            }
            : message);
        const last = messages[messages.length - 1];
        const nextFrom = last && last.index + 1 < page.total ? last.index + 1 : undefined;
        return {
            taskId: record.taskId,
            name: record.name,
            sessionPath,
            messages,
            total: page.total,
            nextFrom,
        };
    }
    async resolve(target) {
        const record = await this.store.find(target);
        if (!record) {
            throw new HerdrError("TASK_NOT_FOUND", `no task matches "${target}"`, {
                remediation: "call herdr_list_agents to see task ids, names, and panes",
            });
        }
        return record;
    }
}
//# sourceMappingURL=transcript.js.map