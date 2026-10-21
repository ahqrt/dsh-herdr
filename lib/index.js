// dsh-herdr — the composition root.
//
// The loader calls apply(ctx, config). Everything below this file is a plain
// service over ports; this is the only place that wires adapters.
import { defineTool } from "@deepseek-ai/dsh-tools";
import { Config, resolveConfig } from "./config.js";
import { systemClock, systemIds } from "./domain/ids.js";
import { expandHome, resolvePaths } from "./domain/paths.js";
import { HerdrCli, resolveHerdrBin } from "./adapters/herdr/cli.js";
import { HerdrCliTransport } from "./adapters/herdr/transport.js";
import { HerdrSocketClient } from "./adapters/herdr/socket-client.js";
import { HerdrSocketTransport } from "./adapters/herdr/socket-transport.js";
import { MachineTransportPool } from "./adapters/transport-pool.js";
import { MachineRuntimePool } from "./adapters/machine/runtime-pool.js";
import { FileAuditLog, FileTaskStore } from "./adapters/fs/store.js";
import { LocalGit } from "./adapters/git/local.js";
import { TopologyService } from "./services/topology.js";
import { HarvestService } from "./services/harvest.js";
import { SpawnService } from "./services/spawn.js";
import { MessageService } from "./services/message.js";
import { InboxService } from "./services/inbox.js";
import { TranscriptService } from "./services/transcript.js";
import { WorktreeService } from "./services/worktree.js";
import { HerdrSubagentProvider } from "./services/subagent-provider.js";
import { RevealService } from "./services/reveal.js";
import { registerSubagentProvider, } from "./services/subagent-registration.js";
import { LifecycleService } from "./services/lifecycle.js";
import { DoctorService } from "./services/doctor.js";
import { createTools, TOOL_NAMES } from "./tools/index.js";
import { createHerdrApi } from "./server/herdr-api.js";
export const name = "tool-herdr";
export const inject = ["tools"];
export { Config, TOOL_NAMES };
export function apply(ctx, rawConfig) {
    const config = resolveConfig(rawConfig);
    const paths = resolvePaths(config);
    const cli = new HerdrCli(resolveHerdrBin(config.herdrBin));
    const cliTransport = new HerdrCliTransport(cli);
    let transport = cliTransport;
    if (config.transport !== "cli") {
        const socketPath = expandHome(process.env.HERDR_SOCKET_PATH || config.socketPath || "~/.config/herdr/herdr.sock");
        transport = new HerdrSocketTransport(new HerdrSocketClient(socketPath), cliTransport, config.transport === "socket" ? "socket" : "auto");
    }
    const store = new FileTaskStore(paths.stateFile, systemClock);
    const audit = new FileAuditLog(paths.auditFile);
    const git = new LocalGit();
    const transports = new MachineTransportPool(transport, config, (machine) => new HerdrCliTransport(new HerdrCli(resolveHerdrBin(config.herdrBin), process.env, machine)));
    const runtimes = new MachineRuntimePool({
        config,
        paths,
        localGit: git,
        sshBin: process.env.SSH_BIN,
        env: process.env,
    });
    const topology = new TopologyService({ transports, store, config, env: process.env });
    const worktree = new WorktreeService({ runtimes });
    const harvest = new HarvestService({ transports, runtimes, config, paths });
    const spawn = new SpawnService({
        transports,
        runtimes,
        store,
        topology,
        harvest,
        worktree,
        config,
        paths,
        audit,
        clock: systemClock,
        ids: systemIds,
    });
    const message = new MessageService({ transports, store, audit });
    const inbox = new InboxService({ store, runtimes });
    const transcript = new TranscriptService(store, runtimes);
    const lifecycle = new LifecycleService({ transports, store, audit, worktree });
    const reveal = new RevealService({ store });
    const herdrApi = createHerdrApi({ store, lifecycle, runtimes, transports, reveal, paths });
    const registerApi = (subContext) => {
        try {
            const register = () => subContext.webServer.register({
                kind: "prefix",
                path: "/herdr/api",
                handler: herdrApi,
            });
            if (typeof subContext.effect === "function") {
                subContext.effect(register, "dsh-herdr: /herdr/api");
            }
            else {
                register();
            }
        }
        catch (error) {
            ctx.logger?.warn(`dsh-herdr web panel API not registered: ${error instanceof Error ? error.message : String(error)}`);
        }
    };
    if (typeof ctx.inject === "function")
        ctx.inject(["webServer"], registerApi);
    const providerStatus = {
        name: config.subagentName,
        registered: false,
    };
    const doctor = new DoctorService({
        transports,
        runtimes,
        config,
        paths,
        env: process.env,
        nativeProvider: providerStatus,
    });
    const deps = {
        config,
        paths,
        store,
        transports,
        spawn,
        harvest,
        message,
        inbox,
        transcript,
        lifecycle,
        doctor,
        ctx,
    };
    for (const tool of createTools(deps, defineTool)) {
        ctx.tools.register(tool);
    }
    if (config.nativeSubagent) {
        const provider = new HerdrSubagentProvider({
            config,
            store,
            transports,
            spawn,
            harvest,
            lifecycle,
        });
        registerSubagentProvider(ctx, provider, providerStatus);
        if (providerStatus.registered) {
            ctx.logger?.info(`dsh-herdr subagent provider "${provider.name}" registered`);
        }
        else if (providerStatus.error) {
            ctx.logger?.warn(`dsh-herdr subagent provider not registered: ${providerStatus.error}`);
        }
    }
    ctx.logger?.info(`dsh-herdr ready: ${config.defaultKind}/${config.defaultModel} · topology ${config.topology} · state ${paths.stateFile}`);
}
//# sourceMappingURL=index.js.map