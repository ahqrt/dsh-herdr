import type { AgentInfo, HerdrAgentStatus, PaneTarget } from "../../domain/types.js";
import type { CreatedTab, CreatedWorkspace, HerdrTransport, PromptOptions, PromptOutcome, StartAgentSpec, WorkspaceRef } from "../../ports/transport.js";
import { HerdrCli } from "./cli.js";
/** Normalize the live snake_case agent object. */
export declare function normalizeAgent(value: unknown): AgentInfo;
export declare class HerdrCliTransport implements HerdrTransport {
    private readonly cli;
    constructor(cli: HerdrCli);
    probe(refresh?: boolean): Promise<import("../../domain/version.js").HerdrProbe>;
    serverStatus(signal?: AbortSignal): Promise<string | undefined>;
    kinds(signal?: AbortSignal): Promise<string[]>;
    listAgents(signal?: AbortSignal): Promise<AgentInfo[]>;
    getAgent(target: string, signal?: AbortSignal): Promise<AgentInfo | undefined>;
    readAgent(target: string, options: {
        lines?: number;
        source?: string;
    }, signal?: AbortSignal): Promise<string>;
    waitForAgent(target: string, options: {
        until: HerdrAgentStatus[];
        timeoutMs: number;
    }, signal?: AbortSignal): Promise<void>;
    startAgent(spec: StartAgentSpec, signal?: AbortSignal): Promise<{
        paneId: string;
    }>;
    promptAgent(target: string, text: string, options: PromptOptions, signal?: AbortSignal): Promise<PromptOutcome>;
    sendKeys(target: string, keys: string[], signal?: AbortSignal): Promise<void>;
    splitPane(paneId: string, options: {
        direction: "right" | "down";
        cwd: string;
    }, signal?: AbortSignal): Promise<PaneTarget>;
    listWorkspaces(signal?: AbortSignal): Promise<WorkspaceRef[]>;
    createWorkspace(options: {
        cwd: string;
        label: string;
    }, signal?: AbortSignal): Promise<CreatedWorkspace>;
    createTab(options: {
        workspaceId: string;
        cwd: string;
        label: string;
    }, signal?: AbortSignal): Promise<CreatedTab>;
    closePane(paneId: string, signal?: AbortSignal): Promise<void>;
}
//# sourceMappingURL=transport.d.ts.map