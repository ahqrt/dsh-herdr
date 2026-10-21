// Read-only HTTP API for the web panel. Same-origin only; the DSH server's
// authentication is the outer gate, and this handler adds an Origin check so a
// cross-site page cannot read task data through the user's browser.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractSessionResultFromText } from "../domain/session.js";
import { artifactPaths } from "../domain/prompt.js";
const MAX_TEXT = 300_000;
export function createHerdrApi(deps) {
    return async (req, res) => {
        if (!sameOrigin(req)) {
            json(res, 403, { ok: false, error: "forbidden" });
            return;
        }
        if (req.method !== "GET" && req.method !== "HEAD") {
            json(res, 405, { ok: false, error: "method not allowed" });
            return;
        }
        const url = new URL(req.url ?? "/", "http://dsh.internal");
        const path = url.pathname;
        try {
            if (path === "/herdr/api/health") {
                json(res, 200, { ok: true, service: "dsh-herdr", version: 1 });
                return;
            }
            if (path === "/herdr/api/fleet") {
                const machine = url.searchParams.get("machine") ?? undefined;
                const agents = await deps.lifecycle.list({ machine });
                json(res, 200, { ok: true, agents });
                return;
            }
            if (path === "/herdr/api/task") {
                const target = url.searchParams.get("target");
                if (!target) {
                    json(res, 400, { ok: false, error: "target is required" });
                    return;
                }
                const detail = await taskDetail(deps, target);
                if (!detail) {
                    json(res, 404, { ok: false, error: "no task matches that handle" });
                    return;
                }
                json(res, 200, { ok: true, task: detail });
                return;
            }
            json(res, 404, { ok: false, error: "unknown endpoint" });
        }
        catch (error) {
            json(res, 500, {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    };
}
async function taskDetail(deps, target) {
    const record = await deps.store.find(target);
    if (!record)
        return undefined;
    const runtime = await deps.runtimes.resolve(record.machine);
    const artifacts = artifactPaths(record.artifactDir);
    const [resultText, sessionText] = await Promise.all([
        runtime.io.readText(artifacts.result).catch(() => undefined),
        record.sessionPath
            ? runtime.io.readText(record.sessionPath).catch(() => undefined)
            : Promise.resolve(undefined),
    ]);
    const finalMessage = sessionText
        ? (extractSessionResultFromText(sessionText)?.text ?? "").trim()
        : "";
    return {
        taskId: record.taskId,
        name: record.name,
        status: record.status,
        kind: record.kind,
        model: record.model,
        thinking: record.thinking,
        role: record.role,
        machine: record.machine,
        cwd: record.cwd,
        paneId: record.paneId,
        tabId: record.tabId,
        workspaceId: record.workspaceId,
        createdAt: record.createdAt,
        promptedAt: record.promptedAt,
        settledAt: record.settledAt,
        sessionPath: record.sessionPath,
        artifactDir: record.artifactDir,
        result: cap(resultText),
        finalMessage: cap(finalMessage),
        diff: cap(readLocalPatch(deps.paths, record.taskId)),
        worktree: record.worktree,
    };
}
function readLocalPatch(paths, taskId) {
    try {
        return readFileSync(join(paths.artifactsRoot, taskId, "diff.patch"), "utf8");
    }
    catch {
        return "";
    }
}
function cap(text) {
    if (!text)
        return { text: "", truncated: false };
    if (text.length <= MAX_TEXT)
        return { text, truncated: false };
    return { text: text.slice(0, MAX_TEXT), truncated: true };
}
function sameOrigin(req) {
    const origin = req.headers.origin;
    const host = req.headers.host;
    if (!origin)
        return true;
    try {
        return new URL(origin).host === host;
    }
    catch {
        return false;
    }
}
function json(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
    });
    res.end(payload);
}
//# sourceMappingURL=herdr-api.js.map