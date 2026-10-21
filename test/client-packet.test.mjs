import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Evaluate the pure buildPacket function out of the client bundle. */
function loadBuildPacket() {
  const source = readFileSync(new URL("../client/index.js", import.meta.url), "utf8");
  const start = source.indexOf("function buildPacket");
  const end = source.indexOf("function statusColor");
  assert.ok(start > 0 && end > start, "buildPacket not found");
  return new Function(`${source.slice(start, end)}; return buildPacket;`)();
}

const task = {
  taskId: "t1",
  name: "demo",
  status: "completed",
  kind: "pi",
  model: "flash",
  role: "worker",
  cwd: "/repo",
  artifactDir: "/tmp/t1",
  sessionPath: "/tmp/t1/s.jsonl",
  summary: "short summary",
  finalMessage: { text: "final words" },
  diff: { text: "diff --git a/a b/a\n+one\n" },
  result: { text: "---\nstatus: completed\n---\nbody" },
};

test("PR packet includes metadata, diff fence, and result", () => {
  const packet = loadBuildPacket()(task, "pr");
  assert.match(packet, /^# Herdr task: demo/m);
  assert.match(packet, /- task: t1/);
  assert.match(packet, /~~~diff/);
  assert.match(packet, /\+one/);
  assert.match(packet, /## result\.md/);
});

test("issue packet omits the diff but keeps evidence paths", () => {
  const packet = loadBuildPacket()(task, "issue");
  assert.match(packet, /^## demo/m);
  assert.doesNotMatch(packet, /~~~diff/);
  assert.match(packet, /diff: .*omitted/);
  assert.match(packet, /artifact: \/tmp\/t1/);
});

test("summary packet is compact and falls back to the final message", () => {
  const withSummary = loadBuildPacket()(task, "summary");
  assert.match(withSummary, /^\*\*demo\*\* — completed/);
  assert.match(withSummary, /short summary/);
  assert.doesNotMatch(withSummary, /diff/);

  const withoutSummary = loadBuildPacket()({ ...task, summary: "" }, "summary");
  assert.match(withoutSummary, /final words/);
});
