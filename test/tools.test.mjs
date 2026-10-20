import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig } from "../lib/defaults.js";
import { resolvePaths } from "../lib/domain/paths.js";
import { createTools, TOOL_NAMES } from "../lib/tools/index.js";
import {
  renderAgentResult,
  renderDoctor,
  renderFleet,
  renderMessage,
} from "../lib/tools/shared.js";

function stubDefineTool(options) {
  return options;
}

function build() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-tools-"));
  const config = resolveConfig({ homeDir: dir });
  const paths = resolvePaths(config);
  const deps = {
    config,
    paths,
    store: {},
    transport: {},
    spawn: {},
    harvest: {},
    message: {},
    lifecycle: {},
    doctor: {},
    ctx: {},
  };
  return { dir, tools: createTools(deps, stubDefineTool) };
}

function assertExplicitObjectSchemas(node, path) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, index) => assertExplicitObjectSchemas(item, `${path}[${index}]`));
    return;
  }
  if (node.type === "object") {
    assert.equal(
      typeof node.additionalProperties,
      "boolean",
      `${path} must declare additionalProperties explicitly`,
    );
  }
  if (node.properties) {
    for (const [key, value] of Object.entries(node.properties)) {
      assertExplicitObjectSchemas(value, `${path}.${key}`);
    }
  }
  if (node.items) assertExplicitObjectSchemas(node.items, `${path}.items`);
}

test("the tool surface is exactly the documented seven", () => {
  const { dir, tools } = build();
  try {
    assert.deepEqual(tools.map((tool) => tool.name), [...TOOL_NAMES]);
    for (const tool of tools) {
      assert.equal(typeof tool.description, "string");
      assert.ok(tool.description.length > 60, `${tool.name} needs a real description`);
      assert.equal(tool.output.schema.type, "object");
      assert.equal(typeof tool.output.render, "function");
      assert.equal(typeof tool.execute, "function");
      assertExplicitObjectSchemas(tool.output.schema, `${tool.name}.output`);
      for (const [key, value] of Object.entries(tool.parameters)) {
        assertExplicitObjectSchemas(value, `${tool.name}.${key}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("spawn requires a prompt and documents its knobs", () => {
  const { dir, tools } = build();
  try {
    const spawn = tools[0];
    assert.equal(spawn.name, "herdr_spawn_agent");
    assert.equal(spawn.parameters.prompt.required, true);
    assert.deepEqual(spawn.parameters.role.enum, ["worker", "reviewer"]);
    assert.equal(spawn.parameters.wait.type, "boolean");
    assert.equal(spawn.parameters.client_task_id.type, "string");
    assert.ok(spawn.presentCall({ prompt: "x", model: "grok4.7" }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("result tool requires a target", () => {
  const { dir, tools } = build();
  try {
    const result = tools.find((tool) => tool.name === "herdr_get_agent_result");
    assert.equal(result.parameters.target.required, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the result renderer carries the review evidence", () => {
  const rendered = renderAgentResult({
    schemaVersion: 1,
    taskId: "t1",
    status: "completed",
    role: "worker",
    agent: { name: "worker-a", paneId: "wV:p9", kind: "pi", model: "xai/grok-4.7" },
    summary: "added retry",
    finalMessage: "done",
    diff: {
      stat: " 1 file changed, 2 insertions(+)",
      files: ["src/a.ts"],
      untracked: [],
      patchPath: "/tmp/d.patch",
      patchBytes: 10,
      truncated: false,
      dirtyAtStart: [],
    },
    result: { path: "/tmp/result.md", text: "body", meta: {} },
    usage: { assistant: 2, toolCalls: 3, outputTokens: 42 },
    timing: { createdAt: 1, elapsedMs: 10 },
    nextAction: "none",
  });
  assert.match(rendered[0].text, /completed/);
  assert.match(rendered[0].text, /final message/);
  assert.match(rendered[0].text, /src\/a\.ts/);

  const running = renderAgentResult({
    schemaVersion: 1,
    taskId: "t1",
    status: "running",
    role: "worker",
    agent: { kind: "pi" },
    summary: "working",
    timing: { createdAt: 1, elapsedMs: 10 },
    nextAction: "wait",
  });
  assert.match(running[0].text, /herdr_get_agent_result/);

  const blocked = renderAgentResult({
    schemaVersion: 1,
    taskId: "t1",
    status: "blocked",
    role: "worker",
    agent: { kind: "pi" },
    summary: "blocked",
    blocked: { question: "Allow writing to /tmp?", tail: "" },
    timing: { createdAt: 1, elapsedMs: 10 },
    nextAction: "answer",
  });
  assert.match(blocked[0].text, /Allow writing/);
});

test("fleet, message, and doctor renderers are stable", () => {
  const fleet = renderFleet([
    { owned: true, name: "worker-a", status: "working", kind: "pi", model: "x", cwd: "/repo" },
  ]);
  assert.match(fleet[0].text, /worker-a/);
  assert.match(fleet[0].text, /spawned by DSH/);

  assert.match(renderMessage({ message: "delivered" })[0].text, /delivered/);

  const doctor = renderDoctor({
    ok: false,
    checks: [{ status: "fail", label: "herdr", detail: "missing" }],
    next: ["install herdr"],
    aliases: [{ alias: "flash", model: "commandcode/x", billing: "", thinking: [] }],
    runtime: { node: "v22", platform: "darwin arm64", topology: "workspace", inHerdrPane: false },
  });
  assert.match(doctor[0].text, /PROBLEMS FOUND/);
  assert.match(doctor[0].text, /install herdr/);
  assert.match(doctor[0].text, /flash→/);
});
