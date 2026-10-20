import test from "node:test";
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { expandHome, isWithin, workspaceLabel, resolvePaths, repoKey } from "../lib/domain/paths.js";

test("expandHome expands only the leading tilde", () => {
  assert.equal(expandHome("~/x"), join(homedir(), "x"));
  assert.equal(expandHome("~"), homedir());
  assert.equal(expandHome("/abs/x"), "/abs/x");
  assert.equal(expandHome("rel/x"), resolve("rel/x"));
});

test("isWithin rejects escapes and sibling prefixes", () => {
  assert.equal(isWithin("/repo/src/a", "/repo"), true);
  assert.equal(isWithin("/repo", "/repo"), true);
  assert.equal(isWithin("/repo-evil/a", "/repo"), false);
  assert.equal(isWithin("/repo/../etc", "/repo"), false);
});

test("workspaceLabel substitutes the repo basename", () => {
  assert.equal(workspaceLabel("DSH · {repo}", "/Users/apple/Desktop/stock/StrataForge"), "DSH · StrataForge");
  assert.equal(workspaceLabel(undefined, "/x/y"), "DSH · y");
});

test("resolvePaths honors overrides and defaults under ~/.dsh/herdr", () => {
  const paths = resolvePaths({});
  assert.equal(paths.stateFile, join(homedir(), ".dsh/herdr/state.json"));
  assert.equal(paths.artifactsRoot, join(homedir(), ".dsh/herdr/tasks"));
  assert.equal(paths.aliasesFile, join(homedir(), ".pi/agent/model-aliases.md"));

  const custom = resolvePaths({ homeDir: "/tmp/h", stateFile: "~/s.json" });
  assert.equal(custom.stateFile, join(homedir(), "s.json"));
  assert.equal(custom.auditFile, join(resolve("/tmp/h"), "audit.ndjson"));
});

test("repoKey normalizes", () => {
  assert.equal(repoKey("/repo/"), resolve("/repo"));
});
