// The plugin's data contract. Everything crossing a boundary is described
// here: Herdr observations, the persisted task record, and the reviewable
// agent result. `docs/result-contract.md` is the prose version of the last one.

/** The state Herdr reports for a recognized agent. */
export type HerdrAgentStatus = "idle" | "working" | "blocked" | "done" | "unknown";

/** Our lifecycle, including the states Herdr cannot express. */
export type TaskStatus =
  | "starting"
  | "working"
  | "blocked"
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "gone"
  | "closed"
  | "interrupted";

export type TaskRole = "worker" | "reviewer";

/** What `herdr agent get/list` tells us, normalized. */
export interface AgentInfo {
  name?: string;
  kind?: string;
  status?: HerdrAgentStatus;
  cwd?: string;
  focused?: boolean;
  paneId?: string;
  tabId?: string;
  workspaceId?: string;
  title?: string;
  sessionPath?: string;
  sessionKind?: string;
}

/** The git state captured immediately before a spawn. */
export interface GitBaseline {
  head?: string;
  dirty: string[];
}

/** The diff the reviewer reads. */
export interface DiffEvidence {
  baselineHead?: string;
  stat: string;
  files: string[];
  untracked: string[];
  patchPath: string;
  patchBytes: number;
  truncated: boolean;
  dirtyAtStart: string[];
}

/** Frontmatter the task envelope asks every agent to write in result.md. */
export interface ResultMeta {
  status?: string;
  summary?: string;
  tests?: string;
  files?: string;
}

/** Token/tool usage recovered from a pi session file. */
export interface SessionUsage {
  assistant: number;
  toolCalls: number;
  outputTokens: number;
}

/** One persisted delegation. */
export interface TaskRecord {
  schemaVersion: 1;
  taskId: string;
  name: string;
  kind: string;
  model?: string;
  thinking?: string;
  cwd: string;
  artifactDir: string;
  role: TaskRole;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  promptedAt?: number;
  settledAt?: number;
  paneId?: string;
  tabId?: string;
  workspaceId?: string;
  sessionPath?: string;
  baseline?: GitBaseline;
  /** Caller-supplied idempotency key. */
  clientTaskId?: string;
  /** A pane we did not spawn (read-only observation). */
  external?: boolean;
  error?: string;
  closedAt?: number;
}

/** The workspace DSH reuses per repository. */
export interface WorkspaceRecord {
  workspaceId: string;
  rootPaneId?: string;
  label?: string;
  updatedAt: number;
}

/** The tool-facing result. This is the review packet. */
export interface AgentResult {
  schemaVersion: 1;
  taskId: string;
  status: TaskStatus;
  role: TaskRole;
  agent: {
    name?: string;
    paneId?: string;
    tabId?: string;
    workspaceId?: string;
    kind: string;
    model?: string;
    thinking?: string;
  };
  herdrStatus?: HerdrAgentStatus;
  /** pi session JSONL, when the kind exposes one. */
  sessionPath?: string;
  summary: string;
  finalMessage?: string;
  result?: {
    path: string;
    text: string;
    meta: ResultMeta;
  };
  diff?: DiffEvidence;
  tests?: string;
  files?: string[];
  usage?: SessionUsage;
  blocked?: {
    question: string;
    tail: string;
  };
  transcriptTail?: string;
  error?: {
    code: string;
    message: string;
  };
  warnings?: string[];
  timing: {
    createdAt: number;
    promptedAt?: number;
    settledAt?: number;
    elapsedMs: number;
  };
  nextAction: "none" | "wait" | "answer" | "inspect";
}

/** Input to a spawn, after tool-argument validation. */
export interface SpawnInput {
  prompt: string;
  cwd: string;
  kind?: string;
  model?: string;
  thinking?: string;
  name?: string;
  role?: TaskRole;
  wait?: boolean;
  timeoutMs?: number;
  agentArgs?: string[];
  clientTaskId?: string;
  sessionId?: string;
  signal?: AbortSignal;
}

/** A pane/tab/workspace triple created or reused for a task. */
export interface PaneTarget {
  paneId: string;
  tabId?: string;
  workspaceId?: string;
  mode: "split" | "workspace";
}
