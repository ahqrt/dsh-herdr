// HTTP API for the web panel. Reads are open to same-origin callers; actions
// require a JSON POST with the panel header, and reuse the lifecycle service's
// ownership gates instead of re-implementing them.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HerdrError } from "../domain/errors.js";
import { type Paths } from "../domain/paths.js";
import { extractSessionResultFromText } from "../domain/session.js";
import { artifactPaths } from "../domain/prompt.js";
import { parseResultMarkdown } from "../domain/result-md.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
import type { LifecycleService } from "../services/lifecycle.js";

const MAX_TEXT = 300_000;
const MAX_BODY = 32 * 1024;

export interface HerdrApiDeps {
  store: TaskStore;
  lifecycle: LifecycleService;
  runtimes: MachineRuntimePool;
  transports: TransportPool;
  paths: Paths;
}

export function createHerdrApi(deps: HerdrApiDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!sameOrigin(req)) {
      json(res, 403, { ok: false, error: "forbidden" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://dsh.internal");
    const path = url.pathname;

    if (req.method === "POST") {
      if (path !== "/herdr/api/action") {
        json(res, 404, { ok: false, error: "unknown endpoint" });
        return;
      }
      await action(deps, req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      json(res, 405, { ok: false, error: "method not allowed" });
      return;
    }

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
      if (path === "/herdr/api/live") {
        const target = url.searchParams.get("target");
        if (!target) {
          json(res, 400, { ok: false, error: "target is required" });
          return;
        }
        const machine = url.searchParams.get("machine") ?? undefined;
        const transport = deps.transports.resolve(machine);
        const agent = await transport.getAgent(target);
        if (!agent) {
          json(res, 404, {
            ok: false,
            error: "no live agent matches that handle",
            code: "AGENT_NOT_FOUND",
          });
          return;
        }
        const text = await transport.readAgent(agent.name ?? target, {
          lines: 100,
          source: "recent-unwrapped",
        });
        json(res, 200, {
          ok: true,
          live: {
            name: agent.name,
            paneId: agent.paneId,
            status: agent.status,
            kind: agent.kind,
            machine,
            tail: cap(text),
          },
        });
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
    } catch (error) {
      sendError(res, error);
    }
  };
}

async function action(
  deps: HerdrApiDeps,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.headers["x-herdr-panel"] !== "1") {
    json(res, 403, { ok: false, error: "missing panel header" });
    return;
  }
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) {
    json(res, 415, { ok: false, error: "content-type must be application/json" });
    return;
  }

  try {
    const body = await readJson(req);
    const target = typeof body.target === "string" ? body.target.trim() : "";
    if (!target || target.length > 200) {
      json(res, 400, { ok: false, error: "target is required" });
      return;
    }
    if (body.action === "interrupt") {
      const result = await deps.lifecycle.interrupt(target);
      json(res, 200, { ok: true, result });
      return;
    }
    if (body.action === "close") {
      const result = await deps.lifecycle.close({
        target,
        force: body.force === true,
        removeWorktree: body.removeWorktree === true,
      });
      json(res, 200, { ok: true, result });
      return;
    }
    json(res, 400, { ok: false, error: 'action must be "interrupt" or "close"' });
  } catch (error) {
    sendError(res, error);
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY) throw new HerdrError("VALIDATION_ERROR", "request body is too large");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HerdrError("VALIDATION_ERROR", "body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof HerdrError) throw error;
    throw new HerdrError("VALIDATION_ERROR", "body is not valid JSON");
  }
}

function sendError(res: ServerResponse, error: unknown): void {
  const code = error instanceof HerdrError ? error.code : "INTERNAL";
  const status =
    code === "TASK_NOT_OWNED"
      ? 403
      : code === "TASK_NOT_FOUND"
        ? 404
        : code === "VALIDATION_ERROR"
          ? 409
          : code === "TIMEOUT"
            ? 504
            : 500;
  json(res, status, {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    code,
  });
}

async function taskDetail(deps: HerdrApiDeps, target: string) {
  const record = await deps.store.find(target);
  if (!record) return undefined;
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
  const parsedResult = resultText ? parseResultMarkdown(resultText) : undefined;

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
    summary: parsedResult?.meta.summary ?? "",
    result: cap(resultText),
    finalMessage: cap(finalMessage),
    diff: cap(readLocalPatch(deps.paths, record.taskId)),
    worktree: record.worktree,
  };
}

function readLocalPatch(paths: Paths, taskId: string): string {
  try {
    return readFileSync(join(paths.artifactsRoot, taskId, "diff.patch"), "utf8");
  } catch {
    return "";
  }
}

function cap(text: string | undefined) {
  if (!text) return { text: "", truncated: false };
  if (text.length <= MAX_TEXT) return { text, truncated: false };
  return { text: text.slice(0, MAX_TEXT), truncated: true };
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(payload);
}
