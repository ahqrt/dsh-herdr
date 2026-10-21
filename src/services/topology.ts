// Decide where a delegated agent lives.
//
//   split     — DSH itself runs inside a Herdr pane (HERDR_ENV=1): split a
//               sibling pane in the caller's tab, never steal focus.
//   workspace — DSH runs in the GUI: create ONE workspace per repository
//               ("DSH · <repo>"), then one tab per task inside it. A tab per
//               task keeps every agent full-width and makes cleanup obvious.

import { HerdrError } from "../domain/errors.js";
import { repoKey, workspaceLabel } from "../domain/paths.js";
import type { PaneTarget } from "../domain/types.js";
import type { PluginConfig } from "../defaults.js";
import type { TransportPool } from "../ports/transports.js";
import type { TaskStore } from "../ports/store.js";

export interface TopologyDeps {
  transports: TransportPool;
  store: TaskStore;
  config: PluginConfig;
  env: NodeJS.ProcessEnv;
}

export class TopologyService {
  constructor(private readonly deps: TopologyDeps) {}

  async ensurePane(input: {
    cwd: string;
    name: string;
    machine?: string;
    signal?: AbortSignal;
  }): Promise<PaneTarget> {
    const { config, env } = this.deps;
    const transport = this.deps.transports.resolve(input.machine);
    const inHerdr = env.HERDR_ENV === "1" && Boolean(env.HERDR_PANE_ID);
    const mode =
      config.topology === "split" || config.topology === "workspace"
        ? config.topology
        : inHerdr
          ? "split"
          : "workspace";

    if (mode === "split") {
      if (!inHerdr || !env.HERDR_PANE_ID) {
        throw new HerdrError(
          "VALIDATION_ERROR",
          "topology=split needs DSH to run inside a Herdr pane (HERDR_ENV=1 and HERDR_PANE_ID)",
          { remediation: "use topology=auto or workspace when DSH runs from the desktop app" },
        );
      }
      return transport.splitPane(
        env.HERDR_PANE_ID,
        { direction: config.splitDirection, cwd: input.cwd },
        input.signal,
      );
    }

    return this.ensureWorkspacePane(input);
  }

  private async ensureWorkspacePane(input: {
    cwd: string;
    name: string;
    machine?: string;
    signal?: AbortSignal;
  }): Promise<PaneTarget> {
    const { store, config } = this.deps;
    const transport = this.deps.transports.resolve(input.machine);
    const key = `${input.machine ?? "local"}:${repoKey(input.cwd)}`;
    const label = workspaceLabel(config.workspaceLabel, input.cwd);

    let workspaceId = (await store.getWorkspace(key))?.workspaceId;
    const workspaces = await transport.listWorkspaces(input.signal);
    const existing = workspaces.find((workspace) => workspace.label === label);
    if (existing) workspaceId = existing.workspaceId;

    if (!workspaceId) {
      const created = await transport.createWorkspace({ cwd: input.cwd, label }, input.signal);
      workspaceId = created.workspaceId;
      await store.setWorkspace(key, {
        workspaceId,
        rootPaneId: created.rootPaneId,
        label,
      });
    }

    try {
      const tab = await transport.createTab(
        { workspaceId, cwd: input.cwd, label: `herdr: ${input.name}` },
        input.signal,
      );
      return { paneId: tab.paneId, tabId: tab.tabId, workspaceId, mode: "workspace" };
    } catch (error) {
      // The user may have closed the workspace since we stored it. Recreate
      // once; a validation/permission failure is not a missing workspace.
      if (!(error instanceof HerdrError)) throw error;
      if (error.code !== "AGENT_NOT_FOUND" && error.code !== "PANE_GONE") throw error;
      const recreated = await transport.createWorkspace({ cwd: input.cwd, label }, input.signal);
      await store.setWorkspace(key, {
        workspaceId: recreated.workspaceId,
        rootPaneId: recreated.rootPaneId,
        label,
      });
      const tab = await transport.createTab(
        { workspaceId: recreated.workspaceId, cwd: input.cwd, label: `herdr: ${input.name}` },
        input.signal,
      );
      return {
        paneId: tab.paneId,
        tabId: tab.tabId,
        workspaceId: recreated.workspaceId,
        mode: "workspace",
      };
    }
  }
}
