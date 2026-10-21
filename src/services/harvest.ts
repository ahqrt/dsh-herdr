// Harvest: turn a settled Herdr agent into a reviewable result.
//
// Priority (most reliable first):
//   1. pi session JSONL — the exact last assistant message, byte-identical
//   2. result.md — the artifact contract every kind is asked to write
//   3. pane tail — the honest fallback for kinds with no session file
//
// Diff evidence is collected from git since the spawn baseline. A session
// message older than the prompt is ignored: it belongs to a previous turn.

import { existsSync, readFileSync } from "node:fs";
import { HerdrError } from "../domain/errors.js";
import { firstLine, parseResultMarkdown } from "../domain/result-md.js";
import {
  extractSessionResult,
  minedAssistantError,
  sessionMtime,
  sessionStats,
} from "../domain/session.js";
import { nextActionFor } from "../domain/status.js";
import type {
  AgentInfo,
  AgentResult,
  HerdrAgentStatus,
  ResultMeta,
  TaskRecord,
  TaskStatus,
} from "../domain/types.js";
import { artifactPaths } from "../domain/prompt.js";
import type { PluginConfig } from "../defaults.js";
import type { GitService } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";

export interface HarvestOptions {
  signal?: AbortSignal;
  tailLines?: number;
  withDiff?: boolean;
}

export interface HarvestDeps {
  transports: TransportPool;
  git: GitService;
  config: PluginConfig;
}

export class HarvestService {
  constructor(private readonly deps: HarvestDeps) {}

  async harvest(record: TaskRecord, options: HarvestOptions = {}): Promise<AgentResult> {
    const { git, config } = this.deps;
    const transport = this.deps.transports.resolve(record.machine);
    const target = record.name || record.paneId || record.taskId;
    const paths = artifactPaths(record.artifactDir);

    let agent: AgentInfo | undefined;
    try {
      agent = await transport.getAgent(target, options.signal);
    } catch (error) {
      // A missing agent is a state, not a crash; anything else is real.
      if (!(error instanceof HerdrError) || error.code !== "AGENT_NOT_FOUND") throw error;
    }

    const herdrStatus = agent?.status;
    const sessionPath = agent?.sessionPath ?? record.sessionPath;
    const promptedAt = record.promptedAt ?? 0;
    const sessionIsFresh =
      !record.external && (!promptedAt || sessionMtime(sessionPath) >= promptedAt - 1_000);
    const sessionResult = sessionIsFresh ? extractSessionResult(sessionPath ?? "") : null;
    const sessionError = record.external ? null : minedAssistantError(sessionResult?.message);
    const usage = sessionIsFresh ? sessionStats(sessionPath) : undefined;

    let meta: ResultMeta = {};
    let resultBody = "";
    let resultPath: string | undefined;
    if (existsSync(paths.result)) {
      try {
        const parsed = parseResultMarkdown(readFileSync(paths.result, "utf8"));
        meta = parsed.meta;
        resultBody = parsed.body;
        resultPath = paths.result;
      } catch {
        /* unreadable artifact is not evidence */
      }
    }

    const finalRaw = sessionResult?.text?.trim() ?? "";
    const bodyText = resultBody.trim() || finalRaw;
    const warnings: string[] = [];
    if (!sessionIsFresh && !record.external && promptedAt > 0) {
      warnings.push(
        "session file has not changed since the prompt; its last message belongs to an earlier turn",
      );
    }

    const status = classify({ herdrStatus, record, sessionError, meta });
    if (status === "completed" && !finalRaw && !resultBody) {
      warnings.push("agent settled but produced no readable final message or result.md");
    }

    const diff =
      options.withDiff !== false && record.cwd && !record.external
        ? await git.diff({
            cwd: record.cwd,
            baseline: record.baseline,
            patchPath: paths.diff,
            maxBytes: config.maxDiffBytes,
          })
        : undefined;

    let transcriptTail: string | undefined;
    if (!finalRaw && !resultBody) {
      transcriptTail = await this.readTail(
        transport,
        target,
        options.tailLines ?? 80,
        options.signal,
      );
    } else if (status === "blocked") {
      transcriptTail = await this.readTail(transport, target, 60, options.signal);
    }

    const maxChars = config.maxResultChars;
    const finalMessage = truncate(finalRaw, maxChars);
    const resultText = truncate(bodyText, maxChars);
    const blockedQuestion =
      status === "blocked" ? extractQuestion(transcriptTail ?? "") : undefined;

    const summary =
      (meta.summary && meta.summary.trim()) ||
      firstLine(sessionResult?.text) ||
      firstLine(resultBody) ||
      (status === "blocked" ? "agent is blocked and needs an answer" : "") ||
      (status === "running" ? "agent is still working" : "") ||
      (status === "gone" ? "the pane is gone" : "");

    return {
      schemaVersion: 1,
      taskId: record.taskId,
      status,
      role: record.role,
      agent: {
        name: record.name,
        paneId: agent?.paneId ?? record.paneId,
        tabId: agent?.tabId ?? record.tabId,
        workspaceId: agent?.workspaceId ?? record.workspaceId,
        kind: record.kind,
        model: record.model,
        thinking: record.thinking,
        machine: record.machine,
      },
      herdrStatus,
      sessionPath,
      worktree: record.worktree,
      summary,
      finalMessage: finalMessage || undefined,
      result: resultPath ? { path: resultPath, text: resultText, meta } : undefined,
      diff,
      tests: meta.tests,
      files: mergeFiles(meta.files, diff?.files),
      usage,
      blocked:
        status === "blocked"
          ? { question: blockedQuestion ?? "", tail: truncate(transcriptTail ?? "", 12_000) }
          : undefined,
      transcriptTail: truncate(transcriptTail ?? "", 12_000) || undefined,
      error: sessionError
        ? { code: "AGENT_FAILED", message: sessionError.errorMessage }
        : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      timing: {
        createdAt: record.createdAt,
        promptedAt: record.promptedAt,
        settledAt: record.settledAt,
        elapsedMs: Math.max(0, Date.now() - record.createdAt),
        queuedMs: record.queuedMs,
      },
      nextAction: nextActionFor(status),
    };
  }

  private async readTail(
    transport: import("../ports/transport.js").HerdrTransport,
    target: string,
    lines: number,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      return await transport.readAgent(target, { lines, source: "recent-unwrapped" }, signal);
    } catch {
      return "";
    }
  }
}

function classify(input: {
  herdrStatus?: HerdrAgentStatus;
  record: TaskRecord;
  sessionError: { errorMessage: string } | null;
  meta: ResultMeta;
}): TaskStatus {
  const { herdrStatus, record, sessionError, meta } = input;

  if (record.external) {
    if (herdrStatus === "blocked") return "blocked";
    if (herdrStatus === "working" || herdrStatus === "unknown") return "running";
    if (herdrStatus === "idle" || herdrStatus === "done") return "idle";
    return "gone";
  }

  if (herdrStatus === "blocked") return "blocked";
  if (herdrStatus === "working" || herdrStatus === "unknown") return "running";
  if (!herdrStatus) return record.status === "closed" ? "closed" : "gone";
  if (sessionError) return "failed";

  const declared = String(meta.status ?? "").toLowerCase();
  if (declared === "failed") return "failed";
  if (declared === "blocked") return "blocked";

  if (herdrStatus === "idle" || herdrStatus === "done") return "completed";
  return "running";
}

function mergeFiles(
  declared: string | undefined,
  changed: string[] | undefined,
): string[] | undefined {
  const files = new Set<string>();
  for (const raw of [declared, changed]) {
    if (!raw) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) if (value) files.add(String(value).trim());
    } else {
      for (const value of String(raw).split(",")) {
        const cleaned = value.trim().replace(/^`|`$/g, "");
        if (cleaned) files.add(cleaned);
      }
    }
  }
  files.delete("none");
  return files.size > 0 ? [...files] : undefined;
}

/** Strip ANSI and TUI chrome, keep the last meaningful lines as the question. */
export function extractQuestion(tail: string): string {
  const lines = String(tail ?? "")
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[│┃┌┐└┘├┤┬┴┼─━═]/g, " ").trimEnd())
    .filter((line) => line.trim().length > 0);
  return lines.slice(-20).join("\n").trim();
}

function truncate(text: string, max: number): string {
  const value = String(text ?? "");
  if (!Number.isFinite(max) || max <= 0 || value.length <= max) return value;
  return `${value.slice(0, max)}\n\n[truncated ${value.length - max} chars]`;
}
