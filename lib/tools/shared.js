// Tool-boundary helpers: cwd resolution, error translation, and the text
// renderers the model actually reads. The renderer is part of the product:
// it is the only thing the model sees of a result.
import { expandHome } from "../domain/paths.js";
import { toToolError } from "../domain/errors.js";
export function text(value) {
    return [{ type: "text", text: value }];
}
/** Resolve the working directory: explicit > session service > session header > host cwd. */
export async function resolveCwd(input) {
    if (input.explicit && input.explicit.trim())
        return expandHome(input.explicit.trim());
    const agent = input.exec.agent;
    try {
        const service = input.ctx.workingDirectory ??
            input.ctx.get?.("workingDirectory");
        if (agent && service?.ensure) {
            const cwd = await service.ensure(agent, input.exec.signal);
            if (cwd)
                return cwd;
        }
    }
    catch {
        /* fall through to the session header */
    }
    const headerCwd = agent?.session?.header?.cwd;
    if (typeof headerCwd === "string" && headerCwd)
        return headerCwd;
    return process.cwd();
}
/** Wrap a tool execute body so every failure reaches DSH as a stable code + fix. */
export function wrapExecute(fn) {
    return async (args, exec) => {
        try {
            return await fn(args, exec);
        }
        catch (error) {
            throw toToolError(error);
        }
    };
}
/** The review packet, rendered for the model. */
export function renderAgentResult(value) {
    const lines = [];
    const model = value.agent.model
        ? ` (${value.agent.model}${value.agent.thinking ? ` · ${value.agent.thinking}` : ""})`
        : "";
    lines.push(`[herdr] ${value.role} ${value.agent.kind}${model} → ${value.status}${value.status === "idle" ? " (observed)" : ""}`);
    if (value.agent.name || value.agent.paneId) {
        lines.push(`agent: ${value.agent.name ?? "?"}${value.agent.paneId ? ` · pane ${value.agent.paneId}` : ""}${value.agent.tabId ? ` · tab ${value.agent.tabId}` : ""}`);
    }
    if (value.worktree) {
        lines.push(`worktree: ${value.worktree.path} (${value.worktree.branch} from ${value.worktree.repo})`);
    }
    if (value.summary)
        lines.push(`summary: ${value.summary}`);
    if (value.error)
        lines.push(`error: ${value.error.code}: ${value.error.message}`);
    if (value.blocked?.question) {
        lines.push("blocked — the agent is waiting for an answer. Ask the user, then call herdr_message_agent:");
        lines.push(value.blocked.question);
    }
    if (value.diff) {
        const files = value.diff.files;
        const lastStat = value.diff.stat
            ? value.diff.stat.split("\n").filter(Boolean).slice(-1)[0]
            : "";
        lines.push(`diff: ${files.length} file(s)${lastStat ? ` · ${lastStat}` : ""}`);
        if (files.length) {
            lines.push(`files: ${files.slice(0, 12).join(", ")}${files.length > 12 ? " …" : ""}`);
        }
        lines.push(`patch: ${value.diff.patchPath}`);
    }
    if (value.tests)
        lines.push(`tests: ${value.tests}`);
    if (value.files?.length)
        lines.push(`changed: ${value.files.slice(0, 20).join(", ")}`);
    if (value.result?.path)
        lines.push(`result: ${value.result.path}`);
    if (value.sessionPath)
        lines.push(`session: ${value.sessionPath}`);
    if (value.usage) {
        lines.push(`usage: ${value.usage.assistant} msg · ${value.usage.toolCalls} tool calls · ${value.usage.outputTokens} output tokens`);
    }
    if (value.warnings?.length)
        lines.push(`warnings: ${value.warnings.join("; ")}`);
    if (value.nextAction === "wait") {
        lines.push("next: call herdr_get_agent_result with wait:true to keep waiting; do not re-submit the task");
    }
    else if (value.nextAction === "answer") {
        lines.push("next: ask the user, then answer with herdr_message_agent");
    }
    if (value.finalMessage) {
        lines.push("", "--- final message ---", value.finalMessage);
    }
    else if (value.result?.text) {
        lines.push("", "--- result.md ---", value.result.text);
    }
    else if (value.transcriptTail) {
        lines.push("", "--- pane tail ---", value.transcriptTail);
    }
    return text(lines.join("\n"));
}
/** The fleet table. */
export function renderFleet(rows) {
    if (rows.length === 0)
        return text("no agents");
    const lines = ["(* = spawned by DSH)"];
    for (const row of rows) {
        lines.push([
            row.owned ? "*" : " ",
            (row.name ?? row.paneId ?? "?").padEnd(22),
            String(row.status ?? "?").padEnd(9),
            String(row.kind ?? "?").padEnd(7),
            String(row.model ?? "-")
                .slice(0, 42)
                .padEnd(42),
            row.cwd ?? "",
        ].join(" "));
    }
    return text(lines.join("\n"));
}
export function renderMessage(value) {
    return text(value.message);
}
export function renderDoctor(value) {
    const lines = [`herdr doctor: ${value.ok ? "OK" : "PROBLEMS FOUND"}`];
    for (const check of value.checks) {
        const marker = check.status === "ok" ? "ok  " : check.status === "warn" ? "warn" : "FAIL";
        lines.push(`[${marker}] ${check.label}: ${check.detail}`);
    }
    lines.push("", `runtime: node ${value.runtime.node} · ${value.runtime.platform} · topology ${value.runtime.topology}`);
    if (value.aliases.length > 0) {
        lines.push(`aliases: ${value.aliases.map((alias) => `${alias.alias}→${alias.model}`).join(", ")}`);
    }
    if (value.next.length > 0) {
        lines.push("", "next:", ...value.next.map((entry) => `- ${entry}`));
    }
    return text(lines.join("\n"));
}
//# sourceMappingURL=shared.js.map