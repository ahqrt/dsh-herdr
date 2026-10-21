// A DSH subagent provider backed by Herdr.
//
// Registering this provider lets a `@deepseek-ai/dsh-tool-subagent` row route
// its `subagent` tool through Herdr instead of an in-process child. The native
// service then owns the catalog/cards/cancellation, while this adapter owns
// spawning and turning the Herdr result into the service's {output, stopReason}.

import { HerdrError } from "../domain/errors.js";
import type { AgentResult } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { TaskStore } from "../ports/store.js";
import type { TransportPool } from "../ports/transports.js";
import type { HarvestService } from "./harvest.js";
import type { LifecycleService } from "./lifecycle.js";
import type { SpawnService } from "./spawn.js";
import { waitForSettle } from "./wait.js";

export interface SubagentRequest {
  prompt: string;
  cwd?: string;
  label?: string;
  parent?: unknown;
  signal?: AbortSignal;
}

export interface SubagentRunHandle {
  id: string;
  result: Promise<{ output: { type: "text"; text: string }[]; stopReason: string }>;
  dispose(): Promise<void>;
}

export interface HerdrSubagentProviderDeps {
  config: PluginConfig;
  store: TaskStore;
  transports: TransportPool;
  spawn: SpawnService;
  harvest: HarvestService;
  lifecycle: LifecycleService;
}

export class HerdrSubagentProvider {
  readonly name: string;
  readonly capabilities = {
    agentOptions: false,
    agentPreset: false,
    outputSchema: false,
    depthLimit: false,
  };
  readonly inheritsParentContext = false;

  constructor(private readonly deps: HerdrSubagentProviderDeps) {
    this.name = deps.config.subagentName || "herdr";
  }

  async start(request: SubagentRequest): Promise<SubagentRunHandle> {
    const started = await this.deps.spawn.spawn({
      prompt: String(request.prompt ?? ""),
      cwd: request.cwd ?? process.cwd(),
      kind: this.deps.config.defaultKind,
      model: this.deps.config.defaultModel,
      role: "worker",
      wait: false,
      timeoutMs: this.deps.config.defaultTimeoutMs,
      signal: request.signal,
    });

    const taskId = started.taskId;
    const result = this.startSettlement(taskId, started, request.signal);
    return {
      id: taskId,
      result,
      dispose: () => this.dispose(taskId),
    };
  }

  private async startSettlement(
    taskId: string,
    started: AgentResult,
    startupSignal?: AbortSignal,
  ): Promise<{ output: { type: "text"; text: string }[]; stopReason: string }> {
    if (started.status !== "running") return toTerminal(started);

    const record = await this.deps.store.find(taskId);
    if (!record) {
      return {
        output: [{ type: "text", text: `task ${taskId} disappeared after spawn` }],
        stopReason: "error",
      };
    }

    let settled: string;
    try {
      const transport = this.deps.transports.resolve(record.machine);
      settled = await waitForSettle(
        transport,
        record.name || record.paneId || taskId,
        this.deps.config.defaultTimeoutMs,
        startupSignal,
      );
    } catch (error) {
      if (error instanceof HerdrError && error.code === "ABORTED") {
        return { output: [], stopReason: "aborted" };
      }
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: [{ type: "text", text: `Herdr wait failed: ${message}` }],
        stopReason: "error",
      };
    }

    try {
      const final = await this.deps.harvest.harvest(record, { signal: startupSignal });
      if (settled === "gone" || final.status === "gone") {
        return {
          output: final.finalMessage ? [{ type: "text", text: final.finalMessage }] : [],
          stopReason: "error",
        };
      }
      return toTerminal(final);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: [{ type: "text", text: `Herdr harvest failed: ${message}` }],
        stopReason: "error",
      };
    }
  }

  private async dispose(taskId: string): Promise<void> {
    try {
      await this.deps.lifecycle.interrupt(taskId);
    } catch {
      /* never started, already settled, or pane gone */
    }
    try {
      await this.deps.lifecycle.close({ target: taskId, force: true });
    } catch {
      /* the pane may already be gone */
    }
  }
}

/** Map the rich AgentResult onto the subagent service's terminal contract. */
export function toTerminal(result: AgentResult): {
  output: { type: "text"; text: string }[];
  stopReason: string;
} {
  if (result.status === "blocked") {
    const question = result.blocked?.question?.trim();
    const text = question
      ? `Blocked and waiting for an answer:\n${question}`
      : "Blocked and waiting for an answer; inspect the pane with herdr_list_agents.";
    return { output: [{ type: "text", text }], stopReason: "error" };
  }
  if (result.status === "failed" || result.status === "gone" || result.status === "closed") {
    const text = result.error?.message || result.summary || `agent ${result.status}`;
    return { output: [{ type: "text", text }], stopReason: "error" };
  }
  if (result.status === "interrupted") return { output: [], stopReason: "aborted" };

  const text = (result.finalMessage || result.result?.text || result.summary || "").trim();
  return {
    output: text ? [{ type: "text", text }] : [],
    stopReason: "stop",
  };
}
