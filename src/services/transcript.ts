// Paged access to a child's pi session. `herdr_get_agent_result` gives the
// final message; this gives the turns that produced it. The web panel uses the
// same service, so the terminal tool and the UI read one transcript format.

import { HerdrError } from "../domain/errors.js";
import { readTranscriptFromText } from "../domain/transcript.js";
import type { TranscriptMessage } from "../domain/transcript.js";
import type { TaskRecord } from "../domain/types.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";

export interface TranscriptReadInput {
  target: string;
  from?: number;
  limit?: number;
  /** Return the last `limit` turns instead of the first page. */
  tail?: boolean;
  signal?: AbortSignal;
}

export interface TranscriptReadResult {
  taskId: string;
  name: string;
  sessionPath: string;
  messages: TranscriptMessage[];
  total: number;
  /** Offset to pass as `from` for the next (later) page, when one exists. */
  nextFrom?: number;
  /** Offset to pass as `from` for the previous (earlier) page, when one exists. */
  prevFrom?: number;
}

const MAX_MESSAGE_CHARS = 6_000;
const MAX_PAGE = 100;

export class TranscriptService {
  constructor(
    private readonly store: TaskStore,
    private readonly runtimes: MachineRuntimePool,
    private readonly transports?: TransportPool,
  ) {}

  async read(input: TranscriptReadInput): Promise<TranscriptReadResult> {
    const record = await this.resolve(input.target);
    let sessionPath = record.sessionPath;
    if (!sessionPath && this.transports) {
      // A spawn that died before settling never stored the session path, but
      // the live pane still knows it. Backfill so the transcript stays readable.
      const handle = record.name ?? record.paneId ?? record.taskId;
      const agent = await this.transports
        .resolve(record.machine)
        .getAgent(handle)
        .catch(() => undefined);
      sessionPath = agent?.sessionPath;
      if (sessionPath) {
        await this.store.update(record.taskId, { sessionPath, updatedAt: Date.now() });
      }
    }
    const runtime = await this.runtimes.resolve(record.machine);
    const text = sessionPath ? await runtime.io.readText(sessionPath) : undefined;
    if (!sessionPath || text === undefined) {
      const reason = sessionPath ? "unreadable" : "no";
      throw new HerdrError(
        "NO_TRANSCRIPT",
        `task ${record.taskId} (${record.kind}) has ${reason} pi session file` +
          (record.error ? ` — ${record.error}` : ""),
        {
          remediation: sessionPath
            ? "the session file is on the task's machine; check machine access, or use herdr_get_agent_result for the pane-tail fallback"
            : "a task that failed before the agent started has no transcript; check the task error, or use herdr_get_agent_result for the pane-tail fallback",
        },
      );
    }

    const all = readTranscriptFromText(text);
    const total = all.length;
    const limit = Math.max(1, Math.min(MAX_PAGE, Math.trunc(input.limit ?? 20)));
    const requested = Math.max(0, Math.trunc(input.from ?? 0));
    const start = input.tail ? Math.max(0, total - limit) : Math.min(requested, total);
    const page = all.slice(start, start + limit);
    const messages = page.map((message) =>
      message.text.length > MAX_MESSAGE_CHARS
        ? {
            ...message,
            text: `${message.text.slice(0, MAX_MESSAGE_CHARS)}\n[message truncated]`,
          }
        : message,
    );
    const end = start + page.length;

    return {
      taskId: record.taskId,
      name: record.name,
      sessionPath,
      messages,
      total,
      nextFrom: end < total ? end : undefined,
      prevFrom: page.length > 0 && start > 0 ? Math.max(0, start - limit) : undefined,
    };
  }

  private async resolve(target: string): Promise<TaskRecord> {
    const record = await this.store.find(target);
    if (!record) {
      throw new HerdrError("TASK_NOT_FOUND", `no task matches "${target}"`, {
        remediation: "call herdr_list_agents to see task ids, names, and panes",
      });
    }
    return record;
  }
}
