import type { AgentInfo, HerdrAgentStatus, PaneTarget } from "../../domain/types.js";
import type { CreatedTab, CreatedWorkspace, HerdrTransport, PromptOptions, PromptOutcome, StartAgentSpec, WorkspaceRef } from "../../ports/transport.js";
import type { HerdrProbe } from "../../domain/version.js";
import { HerdrSocketClient } from "./socket-client.js";
export type SocketMode = "auto" | "socket";
export declare class HerdrSocketTransport implements HerdrTransport {
    private readonly client;
    private readonly fallback;
    private readonly mode;
    private degraded;
    constructor(client: HerdrSocketClient, fallback: HerdrTransport, mode?: SocketMode);
    probe(): Promise<HerdrProbe>;
    serverStatus(signal?: AbortSignal): Promise<string | undefined>;
    kinds(signal?: AbortSignal): Promise<string[]>;
    listAgents(signal?: AbortSignal): Promise<AgentInfo[]>;
    getAgent(target: string, signal?: AbortSignal): Promise<AgentInfo | undefined>;
    readAgent(target: string, options: {
        lines?: number;
        source?: string;
    }, signal?: AbortSignal): Promise<string>;
    startAgent(spec: StartAgentSpec, signal?: AbortSignal): Promise<{
        paneId: string;
    }>;
    promptAgent(target: string, text: string, options: PromptOptions, signal?: AbortSignal): Promise<PromptOutcome>;
    waitForAgent(target: string, options: {
        until: HerdrAgentStatus[];
        timeoutMs: number;
    }, signal?: AbortSignal): Promise<void>;
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
    /**
     * Try the socket, degrade to CLI only when the socket could not be
     * connected at all. A mutation whose response was lost is never retried.
     */
    private call;
}
//# sourceMappingURL=socket-transport.d.ts.map