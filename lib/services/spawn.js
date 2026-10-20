// Spawn orchestration: gates → topology → agent start → prompt → harvest.
//
// Invariants:
//   - a task record exists before a pane does, so a crash cannot orphan a pane
//     silently;
//   - a timeout or abort never kills the agent — it leaves a live handle and
//     an explicit next action;
//   - `clientTaskId` makes a retried tool call idempotent.
import { existsSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadAliases, resolveModelSpec } from "../domain/aliases.js";
import { HerdrError } from "../domain/errors.js";
import { AGENT_NAME_RE, makeAgentName, normalizeAgentName, shortHash } from "../domain/ids.js";
import { buildAgentArgs, kindCaps } from "../domain/launch.js";
import { ensureDir, expandHome, isWithin } from "../domain/paths.js";
import { artifactPaths, buildTaskPrompt } from "../domain/prompt.js";
export class SpawnService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    async spawn(input) {
        const { config, store, transport, clock, ids, paths, audit } = this.deps;
        if (!config.enabled) {
            throw new HerdrError("SPAWN_REFUSED", "herdr delegation is disabled by config (enabled: false)", {
                remediation: "set enabled: true in the tool-herdr config, or restart with a different profile",
            });
        }
        if (input.clientTaskId) {
            const existing = (await store.list()).find((task) => task.clientTaskId === input.clientTaskId);
            if (existing)
                return this.deps.harvest.harvest(existing, { signal: input.signal });
        }
        const cwd = resolve(input.cwd);
        if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
            throw new HerdrError("VALIDATION_ERROR", `cwd does not exist or is not a directory: ${cwd}`, {
                remediation: "pass an absolute path to an existing project directory",
            });
        }
        const allowed = config.allowCwd.map((entry) => expandHome(entry)).filter(Boolean);
        if (allowed.length > 0 && !allowed.some((root) => isWithin(cwd, root))) {
            throw new HerdrError("CWD_NOT_ALLOWED", `cwd ${cwd} is outside allowCwd (${allowed.join(", ")})`, {
                remediation: "add the directory to allowCwd if this delegation is intentional",
            });
        }
        const active = (await store.activeCount());
        if (active >= config.maxParallelAgents) {
            const names = (await store.list())
                .filter((task) => task.status === "starting" || task.status === "working" || task.status === "blocked" || task.status === "running")
                .map((task) => task.name);
            throw new HerdrError("CONCURRENCY_LIMIT", `concurrency cap reached (${active}/${config.maxParallelAgents}): ${names.join(", ")}`, {
                remediation: "close a finished agent with herdr_close_agent, or raise maxParallelAgents",
            });
        }
        const kind = String(input.kind || config.defaultKind).toLowerCase();
        const caps = kindCaps(kind);
        const aliases = loadAliases(paths.aliasesFile);
        const resolvedModel = resolveModelSpec(input.model ?? "", aliases, caps.model ? config.defaultModel : undefined);
        if (resolvedModel.error) {
            throw new HerdrError("VALIDATION_ERROR", resolvedModel.error, {
                remediation: "use a short alias from model-aliases.md or a provider/model id",
            });
        }
        const launch = buildAgentArgs({
            kind,
            model: resolvedModel.model,
            thinking: input.thinking ?? resolvedModel.thinking,
            agentArgs: input.agentArgs,
        });
        if (!launch.ok) {
            throw new HerdrError(launch.error.code, launch.error.message, {
                remediation: launch.error.remediation,
            });
        }
        const fleet = await transport.listAgents(input.signal).catch(() => []);
        const taken = new Set();
        for (const agent of fleet)
            if (agent.name)
                taken.add(agent.name);
        for (const task of await store.list())
            if (task.name)
                taken.add(task.name);
        const requested = input.name ? normalizeAgentName(input.name) : undefined;
        const name = requested || makeAgentName({
            role: input.role ?? "worker",
            flavor: resolvedModel.alias || kind,
            suffix: ids.suffix(),
            taken,
        });
        if (!AGENT_NAME_RE.test(name)) {
            throw new HerdrError("VALIDATION_ERROR", `agent name must match [a-z][a-z0-9_-]{0,31}, got "${name}"`, { remediation: "omit name and let the plugin generate one" });
        }
        if (taken.has(name)) {
            throw new HerdrError("VALIDATION_ERROR", `agent name "${name}" is already live`, {
                remediation: "pick another name or omit name",
            });
        }
        const taskId = ids.taskId(clock.now());
        const artifactDir = resolve(paths.artifactsRoot, taskId);
        ensureDir(artifactDir);
        const artifacts = artifactPaths(artifactDir);
        const timeoutMs = Math.min(3_600_000, Math.max(10_000, input.timeoutMs ?? config.defaultTimeoutMs));
        const promptText = buildTaskPrompt({
            taskId,
            role: input.role ?? "worker",
            prompt: input.prompt,
            cwd,
            artifactDir,
            timeoutMs,
            kind,
        });
        writeFileSync(artifacts.prompt, promptText, "utf8");
        const now = clock.now();
        const record = {
            schemaVersion: 1,
            taskId,
            name,
            kind,
            model: resolvedModel.model,
            thinking: input.thinking ?? resolvedModel.thinking,
            cwd,
            artifactDir,
            role: input.role === "reviewer" ? "reviewer" : "worker",
            status: "starting",
            createdAt: now,
            updatedAt: now,
            clientTaskId: input.clientTaskId,
            baseline: await this.deps.git.baseline(cwd).catch(() => undefined),
        };
        await store.put(record);
        audit.write({
            event: "spawn-intent",
            taskId,
            name,
            kind,
            cwd,
            role: record.role,
            model: record.model,
            clientTaskId: input.clientTaskId,
            requestId: input.clientTaskId ? shortHash(input.clientTaskId) : undefined,
        });
        let pane;
        try {
            pane = await this.deps.topology.ensurePane({ cwd, name, signal: input.signal });
        }
        catch (error) {
            await store.update(taskId, { status: "failed", updatedAt: clock.now(), error: messageOf(error) });
            audit.write({ event: "spawn-failed", taskId, name, stage: "topology", error: messageOf(error) });
            throw error;
        }
        await store.update(taskId, {
            paneId: pane.paneId,
            tabId: pane.tabId,
            workspaceId: pane.workspaceId,
            updatedAt: clock.now(),
        });
        record.paneId = pane.paneId;
        record.tabId = pane.tabId;
        record.workspaceId = pane.workspaceId;
        try {
            await transport.startAgent({
                name,
                kind,
                paneId: pane.paneId,
                argv: launch.data,
                timeoutMs: config.startTimeoutMs,
            }, input.signal);
        }
        catch (error) {
            await store.update(taskId, { status: "failed", updatedAt: clock.now(), error: messageOf(error) });
            audit.write({ event: "spawn-failed", taskId, name, stage: "agent-start", error: messageOf(error) });
            throw error;
        }
        let boot;
        try {
            boot = await this.waitForBoot(name, config.startTimeoutMs, input.signal);
        }
        catch (error) {
            await store.update(taskId, { status: "failed", updatedAt: clock.now(), error: messageOf(error) });
            audit.write({ event: "spawn-failed", taskId, name, stage: "boot", error: messageOf(error) });
            throw error;
        }
        if (boot === "blocked") {
            const settled = await this.deps.harvest.harvest({ ...record, status: "blocked" }, { signal: input.signal });
            await store.update(taskId, {
                status: "blocked",
                updatedAt: clock.now(),
                settledAt: clock.now(),
                sessionPath: settled.sessionPath,
            });
            return settled;
        }
        await store.update(taskId, { status: "working", promptedAt: clock.now(), updatedAt: clock.now() });
        record.promptedAt = clock.now();
        if (input.wait === false) {
            const outcome = await transport.promptAgent(name, promptText, { wait: false, timeoutMs: 20_000 }, input.signal);
            if (outcome === "stalled") {
                throw new HerdrError("AGENT_STALLED", `prompt did not start a turn in ${name}`, {
                    remediation: "inspect the pane with herdr_list_agents, then retry or close it",
                });
            }
            const interim = await this.deps.harvest.harvest({ ...record, status: "working" }, { signal: input.signal });
            return { ...interim, status: interim.status === "blocked" ? "blocked" : "running" };
        }
        const deadline = clock.now() + timeoutMs;
        let outcome;
        try {
            outcome = await this.submit(name, promptText, deadline, input.signal);
        }
        catch (error) {
            const code = error instanceof HerdrError ? error.code : "VALIDATION_ERROR";
            await store.update(taskId, {
                status: code === "ABORTED" ? "interrupted" : "failed",
                updatedAt: clock.now(),
                error: messageOf(error),
            });
            audit.write({ event: code === "ABORTED" ? "spawn-aborted" : "spawn-failed", taskId, name, stage: "prompt", error: messageOf(error) });
            throw error;
        }
        if (outcome === "stalled") {
            await store.update(taskId, { status: "failed", updatedAt: clock.now(), error: "prompt stalled" });
            throw new HerdrError("AGENT_STALLED", `prompt did not start a turn in ${name} after one retry`, {
                remediation: `inspect the pane (${pane.paneId}) with herdr_list_agents; the pane is kept for diagnosis`,
            });
        }
        const settled = await this.deps.harvest.harvest({ ...record, status: outcome === "blocked" ? "blocked" : "working" }, { signal: input.signal });
        await store.update(taskId, {
            status: settled.status,
            updatedAt: clock.now(),
            settledAt: settled.status === "running" ? undefined : clock.now(),
            sessionPath: settled.sessionPath ?? record.sessionPath,
            error: settled.error?.message,
        });
        audit.write({
            event: "spawn-settled",
            taskId,
            name,
            status: settled.status,
            herdrStatus: settled.herdrStatus,
            elapsedMs: settled.timing.elapsedMs,
        });
        if (record.role === "reviewer" && settled.diff?.files.length) {
            settled.warnings = [
                ...(settled.warnings ?? []),
                `reviewer modified ${settled.diff.files.length} file(s); a reviewer is supposed to be read-only`,
            ];
        }
        return settled;
    }
    async submit(name, promptText, deadline, signal) {
        let outcome = "stalled";
        for (let attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0)
                await sleep(2_000);
            const remaining = Math.max(10_000, deadline - Date.now());
            try {
                outcome = await this.deps.transport.promptAgent(name, promptText, {
                    wait: true,
                    timeoutMs: Math.min(remaining, 3_600_000),
                    until: ["idle", "done", "blocked"],
                }, signal);
            }
            catch (error) {
                if (error instanceof HerdrError && error.code === "ABORTED") {
                    await this.interruptQuietly(name);
                    throw error;
                }
                throw error;
            }
            if (outcome !== "stalled")
                return outcome;
        }
        return outcome;
    }
    async waitForBoot(name, timeoutMs, signal) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            if (signal?.aborted)
                throw new HerdrError("ABORTED", "spawn aborted while waiting for agent boot");
            const agent = await this.deps.transport.getAgent(name, signal).catch(() => undefined);
            if (agent?.status === "idle" || agent?.status === "done")
                return "idle";
            if (agent?.status === "blocked")
                return "blocked";
            await sleep(300);
        }
        throw new HerdrError("SPAWN_REFUSED", `agent ${name} never became idle within ${timeoutMs}ms`, {
            remediation: "inspect the new tab in Herdr; the agent may have failed to start",
        });
    }
    async interruptQuietly(name) {
        try {
            await this.deps.transport.sendKeys(name, ["esc"]);
        }
        catch {
            /* the pane may already be gone */
        }
    }
}
function sleep(ms) {
    return new Promise((resolveSleep) => {
        const timer = setTimeout(resolveSleep, ms);
        timer.unref?.();
    });
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=spawn.js.map