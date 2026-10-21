// HerdrTransport over the socket API, with a CLI fallback.
//
// `mode: "auto"` uses the socket only when a connection can be established;
// a connect failure permanently degrades this instance to CLI rather than
// risking a mutation applied twice. `mode: "socket"` never falls back.

import { HerdrError } from "../../domain/errors.js";
import type { AgentInfo, HerdrAgentStatus, PaneTarget } from "../../domain/types.js";
import type {
  CreatedTab,
  CreatedWorkspace,
  HerdrTransport,
  PromptOptions,
  PromptOutcome,
  StartAgentSpec,
  WorkspaceRef,
} from "../../ports/transport.js";
import type { HerdrProbe } from "../../domain/version.js";
import { HerdrSocketClient } from "./socket-client.js";
import { normalizeAgent } from "./transport.js";

export type SocketMode = "auto" | "socket";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringAt(value: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string") return candidate;
  }
  return undefined;
}

export class HerdrSocketTransport implements HerdrTransport {
  private degraded = false;

  constructor(
    private readonly client: HerdrSocketClient,
    private readonly fallback: HerdrTransport,
    private readonly mode: SocketMode = "auto",
  ) {}

  async probe(): Promise<HerdrProbe> {
    return this.fallback.probe(true);
  }

  serverStatus(signal?: AbortSignal): Promise<string | undefined> {
    return this.fallback.serverStatus(signal);
  }

  kinds(signal?: AbortSignal): Promise<string[]> {
    return this.fallback.kinds(signal);
  }

  listAgents(signal?: AbortSignal): Promise<AgentInfo[]> {
    return this.call(
      async () => {
        const result = record(await this.client.request("agent.list", {}, { signal }));
        const agents = Array.isArray(result.agents) ? result.agents : [];
        return agents.map(normalizeAgent);
      },
      () => this.fallback.listAgents(signal),
    );
  }

  getAgent(target: string, signal?: AbortSignal): Promise<AgentInfo | undefined> {
    return this.call(
      async () => {
        try {
          const result = record(await this.client.request("agent.get", { target }, { signal }));
          return normalizeAgent(result.agent ?? result);
        } catch (error) {
          if (
            error instanceof HerdrError &&
            (error.code === "AGENT_NOT_FOUND" || error.code === "PANE_GONE")
          ) {
            return undefined;
          }
          throw error;
        }
      },
      () => this.fallback.getAgent(target, signal),
    );
  }

  readAgent(
    target: string,
    options: { lines?: number; source?: string },
    signal?: AbortSignal,
  ): Promise<string> {
    return this.call(
      async () => {
        const result = record(
          await this.client.request(
            "agent.read",
            {
              target,
              source: socketSource(options.source),
              lines: options.lines ?? 80,
              strip_ansi: true,
            },
            { signal },
          ),
        );
        const read = record(result.read);
        return typeof read.text === "string" ? read.text : "";
      },
      () => this.fallback.readAgent(target, options, signal),
    );
  }

  startAgent(spec: StartAgentSpec, signal?: AbortSignal): Promise<{ paneId: string }> {
    return this.call(
      async () => {
        const result = record(
          await this.client.request(
            "agent.start",
            {
              name: spec.name,
              kind: spec.kind,
              pane_id: spec.paneId,
              args: spec.argv,
              timeout_ms: spec.timeoutMs,
            },
            { timeoutMs: spec.timeoutMs + 15_000, signal },
          ),
        );
        const agent = normalizeAgent(result.agent ?? result);
        const paneId = agent.paneId ?? stringAt(result, "pane_id", "paneId");
        if (!paneId) {
          throw new HerdrError("SPAWN_REFUSED", "socket agent.start returned no pane id", {
            details: result,
          });
        }
        return { paneId };
      },
      () => this.fallback.startAgent(spec, signal),
    );
  }

  promptAgent(
    target: string,
    text: string,
    options: PromptOptions,
    signal?: AbortSignal,
  ): Promise<PromptOutcome> {
    return this.call(
      async () => {
        try {
          await this.client.request(
            "agent.prompt",
            {
              target,
              text,
              wait: options.wait
                ? {
                    until: options.until ?? ["idle", "done", "blocked"],
                    timeout_ms: options.timeoutMs,
                  }
                : null,
            },
            { timeoutMs: options.wait ? options.timeoutMs + 15_000 : 30_000, signal },
          );
          return "submitted";
        } catch (error) {
          if (error instanceof HerdrError) {
            if (error.code === "AGENT_BLOCKED") return "blocked";
            if (error.code === "TIMEOUT") return "timeout";
            if (error.code === "AGENT_STALLED") return "stalled";
          }
          throw error;
        }
      },
      () => this.fallback.promptAgent(target, text, options, signal),
    );
  }

  waitForAgent(
    target: string,
    options: { until: HerdrAgentStatus[]; timeoutMs: number },
    signal?: AbortSignal,
  ): Promise<void> {
    return this.call(
      async () => {
        try {
          await this.client.request(
            "agent.wait",
            { target, until: options.until, timeout_ms: options.timeoutMs },
            { timeoutMs: options.timeoutMs + 15_000, signal },
          );
        } catch (error) {
          if (error instanceof HerdrError && error.code === "TIMEOUT") return;
          throw error;
        }
      },
      () => this.fallback.waitForAgent(target, options, signal),
    );
  }

  sendKeys(target: string, keys: string[], signal?: AbortSignal): Promise<void> {
    return this.call(
      async () => {
        await this.client.request("agent.send_keys", { target, keys }, { signal });
      },
      () => this.fallback.sendKeys(target, keys, signal),
    );
  }

  splitPane(
    paneId: string,
    options: { direction: "right" | "down"; cwd: string },
    signal?: AbortSignal,
  ): Promise<PaneTarget> {
    return this.call(
      async () => {
        const result = record(
          await this.client.request(
            "pane.split",
            {
              direction: options.direction,
              cwd: options.cwd,
              target_pane_id: paneId,
              focus: false,
            },
            { signal },
          ),
        );
        const pane = record(result.pane);
        const created = stringAt(pane, "pane_id", "paneId");
        if (!created) {
          throw new HerdrError("SPAWN_REFUSED", "socket pane.split returned no pane id", {
            details: result,
          });
        }
        return {
          paneId: created,
          tabId: stringAt(pane, "tab_id"),
          workspaceId: stringAt(pane, "workspace_id"),
          mode: "split" as const,
        };
      },
      () => this.fallback.splitPane(paneId, options, signal),
    );
  }

  listWorkspaces(signal?: AbortSignal): Promise<WorkspaceRef[]> {
    return this.call(
      async () => {
        const result = record(await this.client.request("workspace.list", {}, { signal }));
        const workspaces = Array.isArray(result.workspaces) ? result.workspaces : [];
        return workspaces
          .map((value) => {
            const workspace = record(value);
            return {
              workspaceId: stringAt(workspace, "workspace_id", "workspaceId") ?? "",
              label: stringAt(workspace, "label"),
              activeTabId: stringAt(workspace, "active_tab_id"),
            };
          })
          .filter((workspace) => workspace.workspaceId.length > 0);
      },
      () => this.fallback.listWorkspaces(signal),
    );
  }

  createWorkspace(
    options: { cwd: string; label: string },
    signal?: AbortSignal,
  ): Promise<CreatedWorkspace> {
    return this.call(
      async () => {
        const result = record(
          await this.client.request(
            "workspace.create",
            { cwd: options.cwd, label: options.label, focus: false },
            { signal },
          ),
        );
        const workspace = record(result.workspace);
        const workspaceId = stringAt(workspace, "workspace_id", "workspaceId");
        if (!workspaceId) {
          throw new HerdrError(
            "SPAWN_REFUSED",
            "socket workspace.create returned no workspace id",
            {
              details: result,
            },
          );
        }
        return {
          workspaceId,
          tabId: stringAt(record(result.tab), "tab_id"),
          rootPaneId: stringAt(record(result.root_pane), "pane_id"),
        };
      },
      () => this.fallback.createWorkspace(options, signal),
    );
  }

  createTab(
    options: { workspaceId: string; cwd: string; label: string },
    signal?: AbortSignal,
  ): Promise<CreatedTab> {
    return this.call(
      async () => {
        const result = record(
          await this.client.request(
            "tab.create",
            {
              workspace_id: options.workspaceId,
              cwd: options.cwd,
              label: options.label,
              focus: false,
            },
            { signal },
          ),
        );
        const paneId = stringAt(record(result.root_pane), "pane_id");
        if (!paneId) {
          throw new HerdrError("SPAWN_REFUSED", "socket tab.create returned no root pane", {
            details: result,
          });
        }
        return { tabId: stringAt(record(result.tab), "tab_id"), paneId };
      },
      () => this.fallback.createTab(options, signal),
    );
  }

  closePane(paneId: string, signal?: AbortSignal): Promise<void> {
    return this.call(
      async () => {
        await this.client.request("pane.close", { pane_id: paneId }, { signal });
      },
      () => this.fallback.closePane(paneId, signal),
    );
  }

  /**
   * Try the socket, degrade to CLI only when the socket could not be
   * connected at all. A mutation whose response was lost is never retried.
   */
  private async call<T>(socketCall: () => Promise<T>, cliCall: () => Promise<T>): Promise<T> {
    if (this.degraded) return cliCall();
    try {
      return await socketCall();
    } catch (error) {
      if (this.mode === "auto" && canDegrade(error)) {
        this.degraded = true;
        return cliCall();
      }
      throw error;
    }
  }
}

function canDegrade(error: unknown): boolean {
  if (!(error instanceof HerdrError)) return false;
  if (error.code === "HERDR_PROTOCOL") return true;
  if (error.code !== "HERDR_UNAVAILABLE") return false;
  const details = error.details as { phase?: unknown } | undefined;
  return details?.phase === "connect";
}

function socketSource(source: string | undefined): string {
  switch (source) {
    case "recent-unwrapped":
    case "recent_unwrapped":
      return "recent_unwrapped";
    case "detection":
      return "detection";
    case "visible":
      return "visible";
    default:
      return "recent_unwrapped";
  }
}
