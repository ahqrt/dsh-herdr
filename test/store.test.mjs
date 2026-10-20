import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileTaskStore } from "../lib/adapters/fs/store.js";
import { MemoryTaskStore } from "../lib/adapters/fs/memory-store.js";

function record(overrides = {}) {
  return {
    schemaVersion: 1,
    taskId: "t1",
    name: "worker-a",
    kind: "pi",
    cwd: "/repo",
    artifactDir: "/tmp/t1",
    role: "worker",
    status: "working",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

for (const [label, makeStore] of [
  ["FileTaskStore", (dir) => new FileTaskStore(join(dir, "state.json"))],
  ["MemoryTaskStore", () => new MemoryTaskStore()],
]) {
  test(`${label}: put/find/list/update/activeCount`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-store-"));
    try {
      const store = makeStore(dir);
      await store.put(record());
      await store.put(record({ taskId: "t2", name: "worker-b", paneId: "w1:p9", status: "closed", createdAt: 2 }));

      assert.equal((await store.find("t1")).name, "worker-a");
      assert.equal((await store.find("worker-a")).taskId, "t1");
      assert.equal((await store.find("w1:p9")).taskId, "t2");
      assert.equal(await store.find("missing"), undefined);
      assert.equal((await store.list()).length, 2);
      assert.equal(await store.activeCount(), 1);

      const updated = await store.update("t1", { status: "completed" });
      assert.equal(updated.status, "completed");
      assert.equal(await store.activeCount(), 0);
      assert.equal(await store.update("nope", { status: "completed" }), undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test(`${label}: workspace mapping`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "herdr-store-"));
    try {
      const store = makeStore(dir);
      await store.setWorkspace("/repo", { workspaceId: "wV", rootPaneId: "wV:p1", label: "DSH · repo" });
      assert.equal((await store.getWorkspace("/repo")).workspaceId, "wV");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("FileTaskStore persists and reloads", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-store-"));
  try {
    const path = join(dir, "state.json");
    await new FileTaskStore(path).put(record());
    const reopened = new FileTaskStore(path);
    assert.equal((await reopened.list())[0].taskId, "t1");
    assert.equal(JSON.parse(readFileSync(path, "utf8")).schemaVersion, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTaskStore quarantines a corrupt state file instead of throwing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-store-"));
  try {
    const path = join(dir, "state.json");
    writeFileSync(path, "{not json", "utf8");
    const store = new FileTaskStore(path);
    assert.deepEqual(await store.list(), []);
    await store.put(record());
    assert.equal((await store.list())[0].taskId, "t1");
    const files = readFileSync(path, "utf8");
    assert.match(files, /"t1"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("FileTaskStore ignores a stale lock left by a crashed process", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-store-"));
  try {
    const path = join(dir, "state.json");
    const lock = `${path}.lock`;
    writeFileSync(lock, JSON.stringify({ pid: 99999, ts: 0 }));
    const { utimesSync } = await import("node:fs");
    const old = Date.now() / 1000 - 60;
    utimesSync(lock, old, old);
    const store = new FileTaskStore(path);
    await store.put(record());
    assert.equal((await store.list()).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("audit log is append-only NDJSON with a timestamp", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-audit-"));
  try {
    const { FileAuditLog } = await import("../lib/adapters/fs/store.js");
    const path = join(dir, "audit.ndjson");
    const log = new FileAuditLog(path);
    log.write({ event: "spawn", taskId: "t1" });
    log.write({ event: "close", taskId: "t1" });
    const lines = readFileSync(path, "utf8").trim().split("\n");
    assert.equal(lines.length, 2);
    assert.equal(JSON.parse(lines[0]).event, "spawn");
    assert.ok(JSON.parse(lines[1]).ts);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
