import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevealService } from "../lib/services/reveal.js";

function setup(cwd) {
  const calls = [];
  const service = new RevealService({
    store: {
      find: async (target) => (target === "t1" ? { taskId: "t1", cwd } : undefined),
    },
    opener: async (path) => {
      calls.push(path);
    },
    platform: "linux",
  });
  return { service, calls };
}

test("reveal opens an owned task cwd", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-reveal-"));
  try {
    const { service, calls } = setup(dir);
    const result = await service.reveal("t1");
    assert.equal(result.revealed, true);
    assert.equal(result.cwd, dir);
    assert.deepEqual(calls, [dir]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reveal refuses unowned targets and missing cwds", async () => {
  const { service } = setup("/definitely/not/a/task");
  await assert.rejects(service.reveal("nope"), /not spawned by this plugin/);
  await assert.rejects(service.reveal("t1"), /no longer exists or is not a directory/);
});
