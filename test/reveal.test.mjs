import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RevealService } from "../lib/services/reveal.js";

function setup(cwd, editor = { command: "code", args: ["-n"] }) {
  const calls = [];
  const editorCalls = [];
  const service = new RevealService({
    store: {
      find: async (target) => (target === "t1" ? { taskId: "t1", cwd } : undefined),
    },
    editor,
    opener: async (path) => {
      calls.push(path);
    },
    editorOpener: async (command, args, path) => {
      editorCalls.push({ command, args, path });
    },
    platform: "linux",
  });
  return { service, calls, editorCalls };
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

test("open editor uses the configured command, args, and cwd", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-editor-"));
  try {
    const { service, editorCalls } = setup(dir);
    assert.equal(service.editorEnabled(), true);
    const result = await service.openEditor("t1");
    assert.equal(result.revealed, true);
    assert.deepEqual(editorCalls, [{ command: "code", args: ["-n"], path: dir }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("open editor refuses when no command is configured", async () => {
  const dir = mkdtempSync(join(tmpdir(), "herdr-editor-none-"));
  try {
    const { service } = setup(dir, { command: "", args: [] });
    assert.equal(service.editorEnabled(), false);
    await assert.rejects(service.openEditor("t1"), /editorCommand is not configured/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
