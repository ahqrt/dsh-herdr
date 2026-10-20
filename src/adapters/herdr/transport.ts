// HerdrTransport over the CLI. This adapter owns every response-shape detail;
// services only see AgentInfo / PaneTarget / PromptOutcome.

import { HerdrError } from "../../domain/errors.js";
import type { AgentInfo, HerdrAgentStatus, PaneTarget } from "../../domain/types.js";
import { normalizeStatus } from "../../domain/version.js";
import type {
  CreatedTab,
  CreatedWorkspace,
  HerdrTransport,
  PromptOptions,
  PromptOutcome,
  StartAgentSpec,
  WorkspaceRef,
} from "../../ports/transport.js";
import { HerdrCli } from "./cli.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(object: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = object[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

/** Normalize the live snake_case agent object. */
export function normalizeAgent(value: unknown): AgentInfo {
  if (!value || typeof value !== "object") return {};
  const object = asRecord(value);
  const session = asRecord(object.agent_session);
  return {
    name: pickString(object, "name"),
    kind: pickString(object, "agent"),
    status: normalizeStatus(pickString(object, "agent_status", "agentStatus")),
    cwd: pickString(object, "cwd"),
    focused: typeof object.focused === "boolean" ? object.focused : undefined,
    paneId: pickString(object, "pane_id", "paneId"),
    tabId: pickString(object, "tab_id", "tabId"),
    workspaceId: pickString(object, "workspace_id", "workspaceId"),
    title: pickString(object, "terminal_title_stripped", "terminal_title"),
    sessionPath: typeof session.value === "string" ? session.value : undefined,
    sessionKind: typeof session.kind === "string" ? session.kind : undefined,
  };
}

export class HerdrCliTransport implements HerdrTransport {
  constructor(private readonly cli: HerdrCli) {}

  probe(refresh = false) {
    return this.cli.probe(refresh);
  }

  async serverStatus(signal?: AbortSignal): Promise<string | undefined> {
    const result = await this.cli.execWithDefaultTimeout<string>(["status"], {
      text: true,
      signal,
    });
    return result.ok && typeof result.data === "string" ? result.data : undefined;
  }

  async kinds(signal?: AbortSignal): Promise<string[]> {
    const result = await this.cli.exec<string>(["agent"], {
      text: true,
      allowNonZeroText: true,
      timeoutMs: 8_000,
      signal,
    });
    if (!result.ok || typeof result.data !== "string") return [];
    const line = result.data
      .split(/\r?\n/)
      .map((value) => value.trim())
      .reverse()
      .find((value) => value.toLowerCase().startsWith("kinds:"));
    if (!line) return [];
    return line
      .slice(line.indexOf(":") + 1)
      .split("|")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  async listAgents(signal?: AbortSignal): Promise<AgentInfo[]> {
    const result = await this.cli.execWithDefaultTimeout<{ agents?: unknown[] }>(["agent", "list"], {
      signal,
    });
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
    const agents = result.data?.agents;
    return Array.isArray(agents) ? agents.map(normalizeAgent) : [];
  }

  async getAgent(target: string, signal?: AbortSignal): Promise<AgentInfo | undefined> {
    const result = await this.cli.execWithDefaultTimeout<{ agent?: unknown }>(["agent", "get", target], {
      signal,
    });
    if (!result.ok) {
      if (result.error.code === "AGENT_NOT_FOUND" || result.error.code === "PANE_GONE") {
        return undefined;
      }
      throw new HerdrError(result.error.code, result.error.message, result.error);
    }
    return normalizeAgent(result.data?.agent ?? result.data);
  }

  async readAgent(
    target: string,
    options: { lines?: number; source?: string },
    signal?: AbortSignal,
  ): Promise<string> {
    const result = await this.cli.exec<string>(
      [
        "agent",
        "read",
        target,
        "--source",
        options.source ?? "recent-unwrapped",
        "--lines",
        String(options.lines ?? 80),
      ],
      { text: true, signal },
    );
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
    return typeof result.data === "string" ? result.data : "";
  }

  async startAgent(spec: StartAgentSpec, signal?: AbortSignal): Promise<{ paneId: string }> {
    const result = await this.cli.exec<{ agent?: unknown }>(
      [
        "agent",
        "start",
        spec.name,
        "--kind",
        spec.kind,
        "--pane",
        spec.paneId,
        "--timeout",
        String(spec.timeoutMs),
        "--",
        ...spec.argv,
      ],
      { timeoutMs: spec.timeoutMs + 15_000, signal },
    );
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
    const agent = normalizeAgent(result.data?.agent ?? result.data);
    if (!agent.paneId) {
      throw new HerdrError("SPAWN_REFUSED", "agent start returned no pane id", {
        details: result.data,
        remediation: "inspect the new tab in Herdr; the agent may have failed to boot",
      });
    }
    return { paneId: agent.paneId };
  }

  async promptAgent(
    target: string,
    text: string,
    options: PromptOptions,
    signal?: AbortSignal,
  ): Promise<PromptOutcome> {
    const args = ["agent", "prompt", target, text];
    if (options.wait) {
      args.push("--wait");
      for (const state of options.until ?? (["idle", "done", "blocked"] as HerdrAgentStatus[])) {
        args.push("--until", state);
      }
      args.push("--timeout", String(options.timeoutMs));
    }
    const result = await this.cli.exec(args, {
      timeoutMs: options.wait ? options.timeoutMs + 15_000 : 30_000,
      signal,
    });
    if (result.ok) return "submitted";
    switch (result.error.code) {
      case "AGENT_BLOCKED":
        return "blocked";
      case "TIMEOUT":
        return "timeout";
      case "AGENT_STALLED":
        return "stalled";
      default:
        throw new HerdrError(result.error.code, result.error.message, result.error);
    }
  }

  async sendKeys(target: string, keys: string[], signal?: AbortSignal): Promise<void> {
    const result = await this.cli.exec(["agent", "send-keys", target, ...keys], {
      timeoutMs: 15_000,
      signal,
    });
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
  }

  async splitPane(
    paneId: string,
    options: { direction: "right" | "down"; cwd: string },
    signal?: AbortSignal,
  ): Promise<PaneTarget> {
    const result = await this.cli.exec<{ pane?: unknown }>(
      [
        "pane",
        "split",
        "--pane",
        paneId,
        "--direction",
        options.direction,
        "--cwd",
        options.cwd,
        "--no-focus",
      ],
      { signal },
    );
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
    const pane = asRecord(result.data?.pane ?? result.data);
    const createdPaneId = pickString(pane, "pane_id", "paneId");
    if (!createdPaneId) {
      throw new HerdrError("SPAWN_REFUSED", "pane split returned no pane id", {
        details: result.data,
      });
    }
    return {
      paneId: createdPaneId,
      tabId: pickString(pane, "tab_id"),
      workspaceId: pickString(pane, "workspace_id"),
      mode: "split",
    };
  }

  async listWorkspaces(signal?: AbortSignal): Promise<WorkspaceRef[]> {
    const result = await this.cli.execWithDefaultTimeout<{ workspaces?: unknown[] }>(
      ["workspace", "list"],
      { signal },
    );
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
    const workspaces = result.data?.workspaces;
    if (!Array.isArray(workspaces)) return [];
    return workspaces.map((value) => {
      const object = asRecord(value);
      return {
        workspaceId: pickString(object, "workspace_id", "workspaceId") ?? "",
        label: pickString(object, "label"),
        activeTabId: pickString(object, "active_tab_id"),
      };
    }).filter((workspace) => workspace.workspaceId.length > 0);
  }

  async createWorkspace(
    options: { cwd: string; label: string },
    signal?: AbortSignal,
  ): Promise<CreatedWorkspace> {
    const result = await this.cli.exec<{
      workspace?: unknown;
      tab?: unknown;
      root_pane?: unknown;
    }>(["workspace", "create", "--cwd", options.cwd, "--label", options.label, "--no-focus"], {
      signal,
    });
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);
    const workspace = asRecord(result.data?.workspace);
    const workspaceId = pickString(workspace, "workspace_id", "workspaceId");
    if (!workspaceId) {
      throw new HerdrError("SPAWN_REFUSED", "workspace create returned no workspace id", {
        details: result.data,
      });
    }
    return {
      workspaceId,
      tabId: pickString(asRecord(result.data?.tab), "tab_id"),
      rootPaneId: pickString(asRecord(result.data?.root_pane), "pane_id"),
    };
  }

  async createTab(
    options: { workspaceId: string; cwd: string; label: string },
    signal?: AbortSignal,
  ): Promise<CreatedTab> {
    const result = await this.cli.exec<{ tab?: unknown; root_pane?: unknown }>(
      [
        "tab",
        "create",
        "--workspace",
        options.workspaceId,
        "--cwd",
        options.cwd,
        "--label",
        options.label,
        "--no-focus",
      ],
      { signal },
    );
    if (!result.ok) throw new HerdrError(result.error.code, result.error.message, result.error);

    const tabId = pickString(asRecord(result.data?.tab), "tab_id");
    let paneId = pickString(asRecord(result.data?.root_pane), "pane_id");

    if (!paneId && tabId) {
      const panes = await this.cli.exec<{ panes?: unknown[] }>(
        ["pane", "list", "--workspace", options.workspaceId],
        { signal },
      );
      if (panes.ok && Array.isArray(panes.data?.panes)) {
        for (const value of panes.data.panes) {
          const pane = asRecord(value);
          if (pickString(pane, "tab_id") === tabId) {
            paneId = pickString(pane, "pane_id");
            break;
          }
        }
      }
    }
    if (!paneId) {
      throw new HerdrError("SPAWN_REFUSED", "tab create returned no root pane", {
        details: result.data,
        remediation: "check that the workspace still exists, then retry",
      });
    }
    return { tabId, paneId };
  }

  async closePane(paneId: string, signal?: AbortSignal): Promise<void> {
    const result = await this.cli.exec(["pane", "close", paneId], { signal });
    if (!result.ok && result.error.code !== "AGENT_NOT_FOUND" && result.error.code !== "PANE_GONE") {
      throw new HerdrError(result.error.code, result.error.message, result.error);
    }
  }
}
