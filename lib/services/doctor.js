// Environment diagnosis. One call answers "why can't I delegate?" with
// checks that name the exact knob or install step.
import { execFile } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describeAliases, loadAliases, resolveModelSpec } from "../domain/aliases.js";
import { ensureDir } from "../domain/paths.js";
import { formatVersion, MIN_HERDR_VERSION } from "../domain/version.js";
export class DoctorService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async run() {
        const { transport, config, paths, env } = this.deps;
        const checks = [];
        const next = [];
        const add = (status, label, detail) => {
            checks.push({ status, label, detail });
        };
        add(config.enabled ? "ok" : "fail", "enabled", config.enabled ? "true" : "false (spawns are refused)");
        if (!config.enabled)
            next.push("set enabled: true in the tool-herdr config");
        const probe = await transport.probe(true);
        if (probe.state === "ok") {
            add("ok", "herdr", `client ${formatVersion(probe.version)} (floor ${formatVersion(MIN_HERDR_VERSION)})`);
        }
        else if (probe.state === "missing") {
            add("fail", "herdr", "binary not found on PATH");
            next.push("install herdr, or set herdrBin / HERDR_BIN");
        }
        else {
            add("fail", "herdr", "binary ran but --version was unparseable");
        }
        const server = await transport.serverStatus().catch(() => undefined);
        if (server) {
            const block = /server:\s*([\s\S]*?)(?:\n\S|$)/.exec(server)?.[1] ?? "";
            const version = /version:\s*(\S+)/.exec(block)?.[1];
            const protocol = /protocol:\s*(\S+)/.exec(block)?.[1];
            const running = /status:\s*running/.test(block);
            add(running ? "ok" : "warn", "server", running
                ? `running${version ? ` · ${version}` : ""}${protocol ? ` · protocol ${protocol}` : ""}`
                : "not running (Herdr starts it on demand)");
            if (!running)
                next.push("open Herdr once so its server and socket exist");
        }
        else {
            add("warn", "server", "herdr status did not answer");
        }
        const kinds = await transport.kinds().catch(() => []);
        if (kinds.length > 0) {
            add("ok", "agent kinds", `${kinds.length}: ${kinds.slice(0, 10).join(", ")}${kinds.length > 10 ? " …" : ""}`);
            const defaultKind = String(config.defaultKind).toLowerCase();
            add(kinds.includes(defaultKind) ? "ok" : "fail", "default kind", kinds.includes(defaultKind) ? defaultKind : `${defaultKind} is not in the live kind list`);
        }
        else {
            add("warn", "agent kinds", "could not read `herdr agent`");
        }
        const aliases = loadAliases(paths.aliasesFile);
        if (existsSync(paths.aliasesFile)) {
            add("ok", "aliases", `${aliases.size} alias(es) from ${paths.aliasesFile}`);
            const resolved = resolveModelSpec(config.defaultModel, aliases);
            add(resolved.error ? "fail" : "ok", "default model", resolved.error ?? `${config.defaultModel} → ${resolved.model}`);
        }
        else {
            add("warn", "aliases", `${paths.aliasesFile} not found; only provider/model ids will resolve`);
            next.push("create ~/.pi/agent/model-aliases.md or set aliasesFile");
        }
        try {
            ensureDir(paths.artifactsRoot);
            ensureDir(paths.root);
            const probeFile = join(paths.artifactsRoot, `.write-probe-${process.pid}`);
            writeFileSync(probeFile, "ok");
            unlinkSync(probeFile);
            add("ok", "state dirs", `${paths.root} writable`);
        }
        catch (error) {
            add("fail", "state dirs", `not writable: ${error instanceof Error ? error.message : String(error)}`);
            next.push(`fix permissions on ${paths.root}`);
        }
        const inHerdr = env.HERDR_ENV === "1" && Boolean(env.HERDR_PANE_ID);
        const topology = config.topology === "auto" ? (inHerdr ? "split" : "workspace") : config.topology;
        add("ok", "topology", `${topology}${inHerdr ? ` (inside pane ${env.HERDR_PANE_ID})` : ""}`);
        const piVersion = await versionOf("pi");
        add(piVersion ? "ok" : "warn", "pi", piVersion ?? "pi not found on PATH (kind=pi spawns will fail)");
        return {
            ok: !checks.some((check) => check.status === "fail"),
            checks,
            next,
            aliases: describeAliases(aliases),
            runtime: {
                node: process.version,
                platform: `${process.platform} ${process.arch}`,
                topology,
                inHerdrPane: inHerdr,
            },
        };
    }
}
function versionOf(binary) {
    return new Promise((resolve) => {
        execFile(binary, ["--version"], { timeout: 5_000, windowsHide: true }, (error, stdout) => {
            if (error)
                resolve(undefined);
            else
                resolve(String(stdout).trim().split(/\r?\n/)[0]);
        });
    });
}
//# sourceMappingURL=doctor.js.map