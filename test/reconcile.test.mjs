import test from "node:test";
import assert from "node:assert/strict";
import { MemoryTaskStore } from "../lib/adapters/fs/memory-store.js";
import { LifecycleService } from "../lib/services/lifecycle.js";
import { TranscriptService } from "../lib/services/transcript.js";

const SESSION = "/sessions/lemo-cinema.jsonl";

function record(extra = {}) {
  return {
    schemaVersion: 1,
    taskId: "t1",
    name: "lemo-cinema",
    kind: "pi",
    role: "worker",
    cwd: "/repo",
    status: "working",
    createdAt: 1000,
    updatedAt: 1000,
    promptedAt: 2000,
    ...extra,
  };
}

function lifecycleFor(store, agents) {
  const transport = {
    listAgents: async () => agents,
    getAgent: async (handle) =>
      agents.find((agent) => agent.name === handle || agent.paneId === handle),
    closePane: async () => {},
    sendKeys: async () => {},
  };
  const events = [];
  const audit = { write: (event) => events.push(event) };
  const worktree = { remove: async () => {} };
  return {
    service: new LifecycleService({
      transports: { resolve: () => transport },
      store,
      audit,
      worktree,
    }),
    events,
  };
}

test("fleet list settles a working record whose pane is already done", async () => {
  const store = new MemoryTaskStore();
  await store.put(record());
  const { service, events } = lifecycleFor(store, [
    { name: "lemo-cinema", paneId: "w13:p2", status: "done", sessionPath: SESSION, cwd: "/repo" },
  ]);

  const rows = await service.list();

  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "completed");
  const healed = await store.get("t1");
  assert.equal(healed.status, "completed");
  assert.equal(healed.sessionPath, SESSION);
  assert.ok(events.some((event) => event.event === "settle-recovered"));
});

test("a record that was never prompted is not settled by a done pane", async () => {
  const store = new MemoryTaskStore();
  await store.put(record({ promptedAt: undefined }));
  const { service, events } = lifecycleFor(store, [
    { name: "lemo-cinema", paneId: "w13:p2", status: "done", sessionPath: SESSION },
  ]);

  const rows = await service.list();

  assert.equal(rows[0].status, "working");
  assert.equal((await store.get("t1")).sessionPath, undefined);
  assert.equal(events.length, 0);
});

test("working panes stay working", async () => {
  const store = new MemoryTaskStore();
  await store.put(record());
  const { service } = lifecycleFor(store, [
    { name: "lemo-cinema", paneId: "w13:p2", status: "working", sessionPath: SESSION },
  ]);

  const rows = await service.list();

  assert.equal(rows[0].status, "working");
  assert.equal((await store.get("t1")).status, "working");
});

test("transcript backfills a missing session path from the live pane", async () => {
  const store = new MemoryTaskStore();
  await store.put(record({ status: "completed", sessionPath: undefined }));
  const body = [
    { type: "session", version: 3, id: "s1" },
    { type: "message", message: { role: "user", content: "ship it" } },
  ]
    .map((entry) => JSON.stringify(entry))
    .join("\n");
  const runtimes = {
    resolve: async () => ({
      io: { readText: async (path) => (path === SESSION ? body : undefined) },
    }),
  };
  const transports = {
    resolve: () => ({ getAgent: async () => ({ sessionPath: SESSION }) }),
  };
  const service = new TranscriptService(store, runtimes, transports);

  const page = await service.read({ target: "t1" });

  assert.equal(page.sessionPath, SESSION);
  assert.equal((await store.get("t1")).sessionPath, SESSION);
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0].text, "ship it");
});

test("closing an unsettled task keeps its session path", async () => {
  const store = new MemoryTaskStore();
  await store.put(record({ status: "working", paneId: "w13:p2" }));
  const { service } = lifecycleFor(store, [
    { name: "lemo-cinema", paneId: "w13:p2", status: "working", sessionPath: SESSION },
  ]);

  await service.close({ target: "t1", force: true });

  const closed = await store.get("t1");
  assert.equal(closed.status, "closed");
  assert.equal(closed.sessionPath, SESSION);
});
