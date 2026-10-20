// File-backed TaskStore and audit log.
//
// State is small and read on every tool call, so the implementation is
// synchronous inside an async facade. Writes are atomic (temp + rename) and
// serialized with an advisory lock directory-file so two DSH processes (for
// example the desktop app and a headless run) cannot lose an update.

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import { HerdrError } from "../../domain/errors.js";
import { isActiveStatus } from "../../domain/status.js";
import type { TaskRecord, WorkspaceRecord } from "../../domain/types.js";
import type { AuditEvent, AuditLog, TaskStore } from "../../ports/store.js";

interface StateFile {
  schemaVersion: 1;
  tasks: Record<string, TaskRecord>;
  workspaces: Record<string, WorkspaceRecord>;
}

const LOCK_STALE_MS = 15_000;
const LOCK_WAIT_MS = 3_000;
const LOCK_RETRY_MS = 25;

export class FileTaskStore implements TaskStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly lockPath: string;

  constructor(
    private readonly stateFile: string,
    private readonly clock: { now(): number } = { now: () => Date.now() },
  ) {
    this.lockPath = `${stateFile}.lock`;
  }

  put(record: TaskRecord): Promise<TaskRecord> {
    return this.mutate((state) => {
      state.tasks[record.taskId] = record;
      return record;
    });
  }

  update(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord | undefined> {
    return this.mutate((state) => {
      const current = state.tasks[taskId];
      if (!current) return undefined;
      const next = { ...current, ...patch, schemaVersion: 1 as const };
      state.tasks[taskId] = next;
      return next;
    });
  }

  get(taskId: string): Promise<TaskRecord | undefined> {
    return Promise.resolve(this.read().tasks[taskId]);
  }

  find(handle: string): Promise<TaskRecord | undefined> {
    const value = String(handle ?? "").trim();
    if (!value) return Promise.resolve(undefined);
    const tasks = Object.values(this.read().tasks).sort((a, b) => b.createdAt - a.createdAt);
    return Promise.resolve(
      tasks.find((task) => task.taskId === value) ??
        tasks.find((task) => task.name === value) ??
        tasks.find((task) => task.paneId === value),
    );
  }

  list(): Promise<TaskRecord[]> {
    return Promise.resolve(
      Object.values(this.read().tasks).sort((a, b) => b.createdAt - a.createdAt),
    );
  }

  activeCount(): Promise<number> {
    return Promise.resolve(Object.values(this.read().tasks).filter((task) => isActiveStatus(task.status)).length);
  }

  getWorkspace(key: string): Promise<WorkspaceRecord | undefined> {
    return Promise.resolve(this.read().workspaces[key]);
  }

  setWorkspace(key: string, value: Omit<WorkspaceRecord, "updatedAt">): Promise<WorkspaceRecord> {
    return this.mutate((state) => {
      const record: WorkspaceRecord = { ...value, updatedAt: this.clock.now() };
      state.workspaces[key] = record;
      return record;
    });
  }

  // ---- internals ------------------------------------------------------------

  private mutate<T>(fn: (state: StateFile) => T): Promise<T> {
    const run = this.queue.then(() =>
      this.withLock(() => {
        const state = this.read();
        const value = fn(state);
        this.write(state);
        return value;
      }),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  private read(): StateFile {
    if (!existsSync(this.stateFile)) return emptyState();
    try {
      const parsed = JSON.parse(readFileSync(this.stateFile, "utf8")) as Partial<StateFile> & {
        version?: number;
      };
      return {
        schemaVersion: 1,
        tasks: parsed.tasks && typeof parsed.tasks === "object" ? parsed.tasks : {},
        workspaces: parsed.workspaces && typeof parsed.workspaces === "object" ? parsed.workspaces : {},
      };
    } catch {
      // Preserve the broken file for diagnosis and start clean. Losing the
      // registry is recoverable (panes still show in Herdr); refusing to start
      // is not.
      try {
        renameSync(this.stateFile, `${this.stateFile}.corrupt-${this.clock.now()}`);
      } catch {
        /* best effort */
      }
      return emptyState();
    }
  }

  private write(state: StateFile): void {
    mkdirSync(dirname(this.stateFile), { recursive: true });
    const temporary = `${this.stateFile}.${process.pid}.${this.clock.now()}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2), "utf8");
    renameSync(temporary, this.stateFile);
  }

  private withLock<T>(fn: () => T): T {
    mkdirSync(dirname(this.lockPath), { recursive: true });
    const deadline = this.clock.now() + LOCK_WAIT_MS;
    let descriptor: number | undefined;

    while (descriptor === undefined) {
      try {
        descriptor = openSync(this.lockPath, "wx");
        writeSync(descriptor, JSON.stringify({ pid: process.pid, ts: this.clock.now() }));
      } catch (error) {
        if (!isAlreadyExists(error)) {
          throw new HerdrError("STORE_UNAVAILABLE", `cannot acquire state lock: ${messageOf(error)}`, {
            remediation: `check permissions on ${this.lockPath}`,
          });
        }
        this.breakStaleLock();
        if (this.clock.now() >= deadline) {
          throw new HerdrError("STORE_UNAVAILABLE", `timed out waiting for the state lock ${this.lockPath}`, {
            remediation: "another DSH process is stuck holding the lock; remove the .lock file if no DSH is running",
          });
        }
        sleepSync(LOCK_RETRY_MS);
      }
    }

    try {
      return fn();
    } finally {
      try {
        closeSync(descriptor);
      } catch {
        /* ignore */
      }
      try {
        unlinkSync(this.lockPath);
      } catch {
        /* ignore */
      }
    }
  }

  private breakStaleLock(): void {
    try {
      const age = this.clock.now() - statSync(this.lockPath).mtimeMs;
      if (age > LOCK_STALE_MS) rmSync(this.lockPath, { force: true });
    } catch {
      /* the lock disappeared; the next open creates it */
    }
  }
}

function emptyState(): StateFile {
  return { schemaVersion: 1, tasks: {}, workspaces: {} };
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as NodeJS.ErrnoException).code === "EEXIST");
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A synchronous sleep small enough not to matter; avoids extra dependencies. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Append-only audit log with a simple size cap rotation. */
export class FileAuditLog implements AuditLog {
  constructor(
    private readonly path: string,
    private readonly maxBytes = 5 * 1024 * 1024,
  ) {}

  write(event: AuditEvent): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      this.rotateIfNeeded();
      writeFileSync(this.path, `${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`, {
        flag: "a",
      });
    } catch {
      // Auditing never breaks a tool call.
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (statSync(this.path).size < this.maxBytes) return;
      renameSync(this.path, `${this.path}.1`);
    } catch {
      /* no file yet */
    }
  }
}
