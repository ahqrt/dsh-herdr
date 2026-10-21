// Environment diagnosis. One call answers "why can't I delegate?" with
// checks that name the exact knob or install step.

import { execFile } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  describeAliases,
  loadAliases,
  resolveModelSpec,
  type AliasSummary,
} from "../domain/aliases.js";
import { ensureDir, type Paths } from "../domain/paths.js";
import { formatVersion, MIN_HERDR_VERSION } from "../domain/version.js";
import type { PluginConfig } from "../defaults.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TransportPool } from "../ports/transports.js";

export type CheckStatus = "ok" | "warn" | "fail";

export interface DoctorCheck {
  status: CheckStatus;
  label: string;
  detail: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: DoctorCheck[];
  next: string[];
  aliases: AliasSummary[];
  runtime: {
    node: string;
    platform: string;
    topology: string;
    inHerdrPane: boolean;
    machines: string[];
    transport: string;
  };
}

export interface DoctorDeps {
  transports: TransportPool;
  runtimes: MachineRuntimePool;
  config: PluginConfig;
  paths: Paths;
  env: NodeJS.ProcessEnv;
}

export class DoctorService {
  constructor(private readonly deps: DoctorDeps) {}

  async run(): Promise<DoctorReport> {
    const { config, paths, env } = this.deps;
    const transport = this.deps.transports.local();
    const checks: DoctorCheck[] = [];
    const next: string[] = [];
    const add = (status: CheckStatus, label: string, detail: string) => {
      checks.push({ status, label, detail });
    };

    add(
      config.enabled ? "ok" : "fail",
      "enabled",
      config.enabled ? "true" : "false (spawns are refused)",
    );
    if (!config.enabled) next.push("set enabled: true in the tool-herdr config");

    const probe = await transport.probe(true);
    if (probe.state === "ok") {
      add(
        "ok",
        "herdr",
        `client ${formatVersion(probe.version)} (floor ${formatVersion(MIN_HERDR_VERSION)})`,
      );
    } else if (probe.state === "missing") {
      add("fail", "herdr", "binary not found on PATH");
      next.push("install herdr, or set herdrBin / HERDR_BIN");
    } else {
      add("fail", "herdr", "binary ran but --version was unparseable");
    }

    const server = await transport.serverStatus().catch((): undefined => undefined);
    if (server) {
      const block = /server:\s*([\s\S]*?)(?:\n\S|$)/.exec(server)?.[1] ?? "";
      const version = /version:\s*(\S+)/.exec(block)?.[1];
      const protocol = /protocol:\s*(\S+)/.exec(block)?.[1];
      const running = /status:\s*running/.test(block);
      add(
        running ? "ok" : "warn",
        "server",
        running
          ? `running${version ? ` · ${version}` : ""}${protocol ? ` · protocol ${protocol}` : ""}`
          : "not running (Herdr starts it on demand)",
      );
      if (!running) next.push("open Herdr once so its server and socket exist");
    } else {
      add("warn", "server", "herdr status did not answer");
    }

    const kinds = await transport.kinds().catch((): string[] => []);
    if (kinds.length > 0) {
      add(
        "ok",
        "agent kinds",
        `${kinds.length}: ${kinds.slice(0, 10).join(", ")}${kinds.length > 10 ? " …" : ""}`,
      );
      const defaultKind = String(config.defaultKind).toLowerCase();
      add(
        kinds.includes(defaultKind) ? "ok" : "fail",
        "default kind",
        kinds.includes(defaultKind) ? defaultKind : `${defaultKind} is not in the live kind list`,
      );
    } else {
      add("warn", "agent kinds", "could not read `herdr agent`");
    }

    const aliases = loadAliases(paths.aliasesFile);
    if (existsSync(paths.aliasesFile)) {
      add("ok", "aliases", `${aliases.size} alias(es) from ${paths.aliasesFile}`);
      const resolved = resolveModelSpec(config.defaultModel, aliases);
      add(
        resolved.error ? "fail" : "ok",
        "default model",
        resolved.error ?? `${config.defaultModel} → ${resolved.model}`,
      );
    } else {
      add(
        "warn",
        "aliases",
        `${paths.aliasesFile} not found; only provider/model ids will resolve`,
      );
      next.push("create ~/.pi/agent/model-aliases.md or set aliasesFile");
    }

    try {
      ensureDir(paths.artifactsRoot);
      ensureDir(paths.root);
      const probeFile = join(paths.artifactsRoot, `.write-probe-${process.pid}`);
      writeFileSync(probeFile, "ok");
      unlinkSync(probeFile);
      add("ok", "state dirs", `${paths.root} writable`);
    } catch (error) {
      add(
        "fail",
        "state dirs",
        `not writable: ${error instanceof Error ? error.message : String(error)}`,
      );
      next.push(`fix permissions on ${paths.root}`);
    }

    add(
      "ok",
      "transport",
      `${config.transport}${config.transport === "auto" ? " (socket, CLI fallback)" : ""}`,
    );

    const inHerdr = env.HERDR_ENV === "1" && Boolean(env.HERDR_PANE_ID);
    const topology =
      config.topology === "auto" ? (inHerdr ? "split" : "workspace") : config.topology;
    add("ok", "topology", `${topology}${inHerdr ? ` (inside pane ${env.HERDR_PANE_ID})` : ""}`);

    for (const machine of this.deps.transports.machines()) {
      const remote = this.deps.transports.resolve(machine);
      const status = await remote.serverStatus().catch(() => undefined);
      add(
        status ? "ok" : "warn",
        `machine ${machine}`,
        status ? "reachable through herdr --machine" : "no response from herdr --machine",
      );
      if (!status) next.push(`check \`herdr --machine ${machine} status\``);

      const access = this.deps.runtimes.hasRemoteTarget(machine)
        ? "ssh"
        : this.deps.runtimes.sharesFilesystem(machine)
          ? "mounted"
          : "missing";
      add(
        access === "missing" ? "fail" : "ok",
        `machine ${machine} files`,
        access === "ssh"
          ? "SSH file access configured"
          : access === "mounted"
            ? "resolved through a local mount"
            : "no machineTargets or sharedFilesystem entry",
      );
      if (access === "missing") {
        next.push(
          `add machineTargets: ["${machine}=user@host"] or list "${machine}" in sharedFilesystem`,
        );
      }
    }

    const piVersion = await versionOf("pi");
    add(
      piVersion ? "ok" : "warn",
      "pi",
      piVersion ?? "pi not found on PATH (kind=pi spawns will fail)",
    );

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
        machines: this.deps.transports.machines(),
        transport: config.transport,
      },
    };
  }
}

function versionOf(binary: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile(binary, ["--version"], { timeout: 5_000, windowsHide: true }, (error, stdout) => {
      if (error) resolve(undefined);
      else resolve(String(stdout).trim().split(/\r?\n/)[0]);
    });
  });
}
