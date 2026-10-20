// End-to-end across the real services against a fake herdr CLI.
// No live Herdr session is touched.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../lib/defaults.js";
import { resolvePaths } from "../lib/domain/paths.js";
import { systemClock, systemIds } from "../lib/domain/ids.js";
import { HerdrCli } from "../lib/adapters/herdr/cli.js";
import { HerdrCliTransport } from "../lib/adapters/herdr/transport.js";
import { FileAuditLog, FileTaskStore } from "../lib/adapters/fs/store.js";
import { LocalGit } from "../lib/adapters/git/local.js";
import { TopologyService } from "../lib/services/topology.js";
import { HarvestService } from "../lib/services/harvest.js";
import { SpawnService } from "../lib/services/spawn.js";
import { MessageService } from "../lib/services/message.js";
import { LifecycleService } from "../lib/services/lifecycle.js";
import { DoctorService } from "../lib/services/doctor.js";
import { HerdrError } from "../lib/domain/errors.js";

const here = dirname(fileURLToPath(import.meta.url));
const windows = process.platform === "win32";
const fake = join(here, "fixtures", "fake-herdr.mjs");

function git(cwd, ...args) {
  return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
}

function setup() {
  const root = mkdtempSync(join(tmpdir(), "herdr-e2e-"));
  const repo = join(root, "repo");
  execFileSync("mkdir", ["-p", repo]);
  git(repo, "init", "-q");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  writeFileSync(join(repo, "work.txt"), "start\n", "utf8");
  git(repo, "add", "work.txt");
  git(repo, "commit", "-qm", "init");

  chmodSync(fake, 0o755);
  const env = {
    ...process.env,
    HERDR_BIN: fake,
    FAKE_HERDR_STATE: join(root, "fake-state.json"),
    FAKE_HERDR_SESSION: join(root, "session.jsonl"),
    FAKE_HERDR_TOUCH: join(repo, "work.txt"),
    FAKE_HERDR_CWD: repo,
  };

  const config = resolveConfig({
    herdrBin: fake,
    homeDir: join(root, "home"),
    aliasesFile: join(here, "fixtures", "aliases.md"),
    defaultModel: "flash",
    allowCwd: [repo],
    defaultTimeoutMs: 30_000,
  });
  const paths = resolvePaths(config);
  const cli = new HerdrCli(fake, env);
  const transport = new HerdrCliTransport(cli);
  const store = new FileTaskStore(paths.stateFile, systemClock);
  const audit = new FileAuditLog(paths.auditFile);
  const gitService = new LocalGit();
  const topology = new TopologyService({ transport, store, config, env: {} });
  const harvest = new HarvestService({ transport, git: gitService, config });
  const spawn = new SpawnService({
    transport,
    store,
    git: gitService,
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
  const doctor = new DoctorService({ transport, config, paths, env: {} });

  return {
    root,
    repo,
    env,
    config,
    paths,
    store,
    spawn,
    harvest,
    message,
    lifecycle,
    doctor,
    transport,
  };
}

function cleanup(root) {
  rmSync(root, { recursive: true, force: true });
}

test("spawn → exact harvest → diff → message → interrupt → close", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    const result = await ctx.spawn.spawn({
      prompt: "Add the retry behavior to work.txt",
      cwd: ctx.repo,
      kind: "pi",
      model: "flash",
      signal: new AbortController().signal,
    });

    assert.equal(result.status, "completed");
    assert.equal(result.role, "worker");
    assert.match(result.agent.name, /^worker-flash-[0-9a-f]{4}$/);
    assert.equal(result.agent.model, "commandcode/deepseek/deepseek-v4.1-flash");
    assert.match(result.finalMessage, /COMPLETE: fake agent finished/);
    assert.equal(result.result.path, join(ctx.paths.artifactsRoot, result.taskId, "result.md"));
    assert.equal(result.result.text, "Fake detail body.");
    assert.equal(result.usage.outputTokens, 11);
    assert.equal(result.nextAction, "none");

    assert.ok(result.diff);
    assert.ok(result.diff.files.includes("work.txt"));
    assert.ok(existsSync(result.diff.patchPath));
    assert.match(readFileSync(result.diff.patchPath, "utf8"), /\+agent change/);

    const stored = await ctx.store.find(result.taskId);
    assert.equal(stored.status, "completed");
    assert.equal(stored.paneId, result.agent.paneId);
    assert.equal(stored.sessionPath, result.sessionPath);
    assert.ok(stored.promptedAt > 0);

    const audit = readFileSync(ctx.paths.auditFile, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.ok(audit.some((entry) => entry.event === "spawn-intent"));
    assert.ok(
      audit.some((entry) => entry.event === "spawn-settled" && entry.status === "completed"),
    );

    const fleet = await ctx.lifecycle.list({});
    assert.equal(fleet.length, 1);
    assert.equal(fleet[0].owned, true);
    assert.equal(fleet[0].taskId, result.taskId);

    const sent = await ctx.message.send({
      target: result.agent.name,
      message: "[MAJOR] work.txt:1 — fake finding — fake reason — fake test",
      kind: "REVIEW_FINDINGS",
      round: 1,
    });
    assert.equal(sent.delivered, true);
    assert.equal(sent.target, result.agent.name);

    const interrupted = await ctx.lifecycle.interrupt(result.taskId);
    assert.equal(interrupted.interrupted, true);

    const closed = await ctx.lifecycle.close({ target: result.taskId });
    assert.equal(closed.closed, true);
    assert.equal((await ctx.store.find(result.taskId)).status, "closed");

    const after = await ctx.lifecycle.list({ ownedOnly: true });
    assert.equal(after.length, 0);
  } finally {
    cleanup(ctx.root);
  }
});

test("a clientTaskId makes a retried spawn idempotent", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    const args = {
      prompt: "Do it once",
      cwd: ctx.repo,
      kind: "pi",
      model: "flash",
      clientTaskId: "call-42",
    };
    const first = await ctx.spawn.spawn(args);
    const second = await ctx.spawn.spawn(args);
    assert.equal(first.taskId, second.taskId);
    assert.equal((await ctx.store.list()).length, 1);
  } finally {
    cleanup(ctx.root);
  }
});

test("the concurrency cap refuses a second live spawn", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    await ctx.store.put({
      schemaVersion: 1,
      taskId: "held",
      name: "worker-held",
      kind: "pi",
      cwd: ctx.repo,
      artifactDir: join(ctx.paths.artifactsRoot, "held"),
      role: "worker",
      status: "working",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    ctx.config.maxParallelAgents = 1;
    const result = ctx.spawn.spawn({
      prompt: "x",
      cwd: ctx.repo,
      kind: "pi",
      signal: new AbortController().signal,
    });
    await assert.rejects(result, (error) => {
      assert.ok(error instanceof HerdrError);
      assert.equal(error.code, "CONCURRENCY_LIMIT");
      assert.match(error.message, /worker-held/);
      return true;
    });
  } finally {
    cleanup(ctx.root);
  }
});

test("cwd outside allowCwd is refused before a pane exists", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    const outside = mkdtempSync(join(tmpdir(), "herdr-outside-"));
    await assert.rejects(
      ctx.spawn.spawn({
        prompt: "x",
        cwd: outside,
        kind: "pi",
        signal: new AbortController().signal,
      }),
      (error) => error instanceof HerdrError && error.code === "CWD_NOT_ALLOWED",
    );
    rmSync(outside, { recursive: true, force: true });
  } finally {
    cleanup(ctx.root);
  }
});

test("a kind that refuses model fails before a pane exists", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    await assert.rejects(
      ctx.spawn.spawn({
        prompt: "x",
        cwd: ctx.repo,
        kind: "agy",
        model: "flash",
        signal: new AbortController().signal,
      }),
      (error) => error instanceof HerdrError && /refuses --model/.test(error.message),
    );
  } finally {
    cleanup(ctx.root);
  }
});

test("doctor reports a healthy fake environment", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    const report = await ctx.doctor.run();
    assert.equal(report.checks.find((check) => check.label === "herdr").status, "ok");
    assert.equal(report.checks.find((check) => check.label === "agent kinds").status, "ok");
    assert.equal(report.aliases.length, 2);
    assert.equal(report.runtime.topology, "workspace");
  } finally {
    cleanup(ctx.root);
  }
});

test("closing an unowned handle is refused", {
  skip: windows && "fake herdr needs a POSIX shebang",
}, async () => {
  const ctx = setup();
  try {
    await assert.rejects(
      ctx.lifecycle.close({ target: "wV:p2" }),
      (error) => error instanceof HerdrError && error.code === "TASK_NOT_OWNED",
    );
  } finally {
    cleanup(ctx.root);
  }
});
