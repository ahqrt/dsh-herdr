// The persistence port. The file-backed adapter is the shipped one; tests use
// the in-memory adapter. Services never read the state file directly.

import type { TaskRecord, WorkspaceRecord } from "../domain/types.js";

export interface TaskStore {
  put(record: TaskRecord): Promise<TaskRecord>;
  update(taskId: string, patch: Partial<TaskRecord>): Promise<TaskRecord | undefined>;
  get(taskId: string): Promise<TaskRecord | undefined>;
  /** Resolve a task id, agent name, or pane id. */
  find(handle: string): Promise<TaskRecord | undefined>;
  list(): Promise<TaskRecord[]>;
  activeCount(): Promise<number>;

  getWorkspace(key: string): Promise<WorkspaceRecord | undefined>;
  setWorkspace(key: string, value: Omit<WorkspaceRecord, "updatedAt">): Promise<WorkspaceRecord>;
}

export interface AuditEvent {
  event: string;
  [key: string]: unknown;
}

export interface AuditLog {
  write(event: AuditEvent): void;
}

export interface GitBaselineInput {
  cwd: string;
}

export interface GitDiffInput {
  cwd: string;
  baseline?: import("../domain/types.js").GitBaseline;
  patchPath: string;
  maxBytes: number;
}

export interface GitService {
  isRepo(cwd: string): Promise<boolean>;
  baseline(cwd: string): Promise<import("../domain/types.js").GitBaseline | undefined>;
  diff(input: GitDiffInput): Promise<import("../domain/types.js").DiffEvidence | undefined>;
  status(cwd: string): Promise<string[]>;
}
