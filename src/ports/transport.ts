// The outbound port: everything the plugin needs from Herdr, expressed as
// domain operations. The CLI adapter implements it today; a future socket or
// SSH adapter can replace it without touching services or tools.

import type { AgentInfo, HerdrAgentStatus, PaneTarget } from "../domain/types.js";
import type { HerdrProbe } from "../domain/version.js";

export interface ListOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface PromptOptions {
  wait: boolean;
  timeoutMs: number;
  until?: HerdrAgentStatus[];
}

/** How a submitted prompt ended, from the caller's point of view. */
export type PromptOutcome = "submitted" | "blocked" | "timeout" | "stalled";

export interface StartAgentSpec {
  name: string;
  kind: string;
  paneId: string;
  /** argv after `--`. */
  argv: string[];
  timeoutMs: number;
}

export interface WorkspaceRef {
  workspaceId: string;
  label?: string;
  activeTabId?: string;
}

export interface CreatedWorkspace {
  workspaceId: string;
  tabId?: string;
  rootPaneId?: string;
}

export interface CreatedTab {
  tabId?: string;
  paneId: string;
}

export interface HerdrTransport {
  probe(refresh?: boolean): Promise<HerdrProbe>;
  serverStatus(signal?: AbortSignal): Promise<string | undefined>;
  kinds(signal?: AbortSignal): Promise<string[]>;

  listAgents(signal?: AbortSignal): Promise<AgentInfo[]>;
  getAgent(target: string, signal?: AbortSignal): Promise<AgentInfo | undefined>;
  readAgent(
    target: string,
    options: { lines?: number; source?: string },
    signal?: AbortSignal,
  ): Promise<string>;

  /** Server-side wait for one of `until`; resolves on match or timeout. */
  waitForAgent(
    target: string,
    options: { until: HerdrAgentStatus[]; timeoutMs: number },
    signal?: AbortSignal,
  ): Promise<void>;

  startAgent(spec: StartAgentSpec, signal?: AbortSignal): Promise<{ paneId: string }>;
  promptAgent(
    target: string,
    text: string,
    options: PromptOptions,
    signal?: AbortSignal,
  ): Promise<PromptOutcome>;
  sendKeys(target: string, keys: string[], signal?: AbortSignal): Promise<void>;

  splitPane(
    paneId: string,
    options: { direction: "right" | "down"; cwd: string },
    signal?: AbortSignal,
  ): Promise<PaneTarget>;
  listWorkspaces(signal?: AbortSignal): Promise<WorkspaceRef[]>;
  createWorkspace(
    options: { cwd: string; label: string },
    signal?: AbortSignal,
  ): Promise<CreatedWorkspace>;
  createTab(
    options: { workspaceId: string; cwd: string; label: string },
    signal?: AbortSignal,
  ): Promise<CreatedTab>;
  closePane(paneId: string, signal?: AbortSignal): Promise<void>;
}
