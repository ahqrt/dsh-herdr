export interface HostSession {
    id?: string;
    header?: {
        cwd?: string;
    };
}
export interface ToolExecution {
    signal?: AbortSignal;
    agent?: {
        session?: HostSession;
    };
}
export interface WorkingDirectoryService {
    ensure(agent: unknown, signal?: AbortSignal): Promise<string>;
}
export interface PluginLogger {
    info(message: string): void;
    warn(message: string): void;
}
export interface PluginContext {
    tools: {
        register(tool: unknown): void;
    };
    get?(name: string): unknown;
    workingDirectory?: WorkingDirectoryService;
    logger?: PluginLogger;
}
export type DefineTool = (options: Record<string, unknown>) => unknown;
export interface ToolFactoryOptions {
    defineTool: DefineTool;
    deps: ToolFactoryDeps;
}
export interface ToolFactoryDeps {
    config: import("./defaults.js").PluginConfig;
    paths: import("./domain/paths.js").Paths;
    store: import("./ports/store.js").TaskStore;
    transport: import("./ports/transport.js").HerdrTransport;
    spawn: import("./services/spawn.js").SpawnService;
    harvest: import("./services/harvest.js").HarvestService;
    message: import("./services/message.js").MessageService;
    inbox: import("./services/inbox.js").InboxService;
    transcript: import("./services/transcript.js").TranscriptService;
    lifecycle: import("./services/lifecycle.js").LifecycleService;
    doctor: import("./services/doctor.js").DoctorService;
    ctx: PluginContext;
}
//# sourceMappingURL=host.d.ts.map