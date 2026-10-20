// Consume child → DSH messages from task inboxes.
//
// `wait` is a long-poll over the files: no background watcher, no event loop
// to leak. A read returns as soon as any task has unconsumed messages.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { HerdrError } from "../domain/errors.js";
import { lineCount, parseInbox, type InboxMessage } from "../domain/inbox.js";
import type { TaskRecord, TaskStatus } from "../domain/types.js";
import type { TaskStore } from "../ports/store.js";

export interface InboxEntry extends InboxMessage {
  taskId: string;
  name: string;
  taskStatus: TaskStatus;
}

export interface InboxReadInput {
  target?: string;
  wait?: boolean;
  timeoutMs?: number;
  consume?: boolean;
  limit?: number;
  signal?: AbortSignal;
}

export interface InboxReadResult {
  messages: InboxEntry[];
  /** Messages left for later (limit or later reads). */
  remaining: number;
  waitedMs: number;
  /** Lines that were not valid message objects. */
  malformed: number;
}

export interface InboxDeps {
  store: TaskStore;
}

export class InboxService {
  constructor(private readonly deps: InboxDeps) {}

  async read(input: InboxReadInput = {}): Promise<InboxReadResult> {
    const started = Date.now();
    const timeoutMs = Math.max(0, input.timeoutMs ?? 30_000);
    const limit = Math.max(1, Math.min(200, input.limit ?? 50));
    const deadline = started + timeoutMs;

    for (;;) {
      if (input.signal?.aborted) throw new HerdrError("ABORTED", "inbox read aborted");
      const tasks = await this.targets(input.target);
      const snapshot = this.snapshot(tasks, limit);

      if (snapshot.messages.length > 0) {
        if (input.consume !== false) await this.consume(snapshot.offsets);
        return {
          messages: snapshot.messages,
          remaining: snapshot.remaining,
          waitedMs: Date.now() - started,
          malformed: snapshot.malformed,
        };
      }

      if (!input.wait || Date.now() >= deadline) {
        return {
          messages: [],
          remaining: snapshot.remaining,
          waitedMs: Date.now() - started,
          malformed: snapshot.malformed,
        };
      }
      await sleep(500);
    }
  }

  private async targets(target?: string): Promise<TaskRecord[]> {
    if (target) {
      const record = await this.deps.store.find(target);
      if (!record) {
        throw new HerdrError("TASK_NOT_FOUND", `no task matches "${target}"`, {
          remediation: "call herdr_list_agents to see task ids, names, and panes",
        });
      }
      return [record];
    }
    return (await this.deps.store.list()).filter((task) => task.status !== "closed");
  }

  private snapshot(tasks: TaskRecord[], limit: number) {
    const messages: InboxEntry[] = [];
    const offsets: { taskId: string; offset: number }[] = [];
    let pendingTotal = 0;
    let malformed = 0;

    for (const task of tasks) {
      const path = join(task.artifactDir, "inbox.ndjson");
      if (!existsSync(path)) continue;
      let text: string;
      try {
        text = readFileSync(path, "utf8");
      } catch {
        continue;
      }
      const parsed = parseInbox(text);
      malformed += parsed.malformed;
      const offset = Math.min(task.inboxOffset ?? 0, lineCount(text));
      const pending = parsed.messages.filter((message) => message.index >= offset);
      pendingTotal += pending.length;

      const room = limit - messages.length;
      if (room <= 0) continue;
      const taken = pending.slice(0, room);
      for (const message of taken) {
        messages.push({
          ...message,
          taskId: task.taskId,
          name: task.name,
          taskStatus: task.status,
        });
      }
      if (taken.length > 0) {
        const last = taken[taken.length - 1];
        offsets.push({ taskId: task.taskId, offset: (last?.index ?? offset) + 1 });
      }
    }

    return {
      messages,
      offsets,
      remaining: Math.max(0, pendingTotal - messages.length),
      malformed,
    };
  }

  private async consume(offsets: { taskId: string; offset: number }[]): Promise<void> {
    for (const entry of offsets) {
      await this.deps.store.update(entry.taskId, {
        inboxOffset: entry.offset,
        updatedAt: Date.now(),
      });
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}
