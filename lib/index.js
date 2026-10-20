// dsh-herdr — the composition root.
//
// The loader calls apply(ctx, config). Everything below this file is a plain
// service over ports; this is the only place that wires adapters.
import { defineTool } from "@deepseek-ai/dsh-tools";
import { Config, resolveConfig } from "./config.js";
import { systemClock, systemIds } from "./domain/ids.js";
import { resolvePaths } from "./domain/paths.js";
import { HerdrCli, resolveHerdrBin } from "./adapters/herdr/cli.js";
import { HerdrCliTransport } from "./adapters/herdr/transport.js";
import { FileAuditLog, FileTaskStore } from "./adapters/fs/store.js";
import { LocalGit } from "./adapters/git/local.js";
import { TopologyService } from "./services/topology.js";
import { HarvestService } from "./services/harvest.js";
import { SpawnService } from "./services/spawn.js";
import { MessageService } from "./services/message.js";
import { LifecycleService } from "./services/lifecycle.js";
import { DoctorService } from "./services/doctor.js";
import { createTools, TOOL_NAMES } from "./tools/index.js";
export const name = "tool-herdr";
export const inject = ["tools"];
export { Config, TOOL_NAMES };
export function apply(ctx, rawConfig) {
    const config = resolveConfig(rawConfig);
    const paths = resolvePaths(config);
    const cli = new HerdrCli(resolveHerdrBin(config.herdrBin));
    const transport = new HerdrCliTransport(cli);
    const store = new FileTaskStore(paths.stateFile, systemClock);
    const audit = new FileAuditLog(paths.auditFile);
    const git = new LocalGit();
    const topology = new TopologyService({ transport, store, config, env: process.env });
    const harvest = new HarvestService({ transport, git, config });
    const spawn = new SpawnService({
        transport,
        store,
        git,
        topology,
        harvest,
        config,
        paths,
        audit,
        clock: systemClock,
        ids: systemIds,
    });
    const message = new MessageService({ transport, store, audit });
    const lifecycle = new LifecycleService({ transport, store, audit });
    const doctor = new DoctorService({ transport, config, paths, env: process.env });
    const deps = {
        config,
        paths,
        store,
        transport,
        spawn,
        harvest,
        message,
        lifecycle,
        doctor,
        ctx,
    };
    for (const tool of createTools(deps, defineTool)) {
        ctx.tools.register(tool);
    }
    ctx.logger?.info(`dsh-herdr ready: ${config.defaultKind}/${config.defaultModel} · topology ${config.topology} · state ${paths.stateFile}`);
}
//# sourceMappingURL=index.js.map