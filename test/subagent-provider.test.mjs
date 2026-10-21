import test from "node:test";
import assert from "node:assert/strict";
import { HerdrSubagentProvider, toTerminal } from "../lib/services/subagent-provider.js";
import { resolveConfig } from "../lib/defaults.js";

function agentResult(overrides = {}) {
  return {
    schemaVersion: 1,
    taskId: "t1",
    status: "completed",
    role: "worker",
    agent: { kind: "pi" },
    summary: "done",
    finalMessage: "the answer",
    timing: { createdAt: 1, elapsedMs: 10 },
    nextAction: "none",
    ...overrides,
  };
}

function setup({ started = agentResult({ status: "running" }), final = agentResult() } = {}) {
  const calls = [];
  const record = {
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
  };
  const provider = new HerdrSubagentProvider({
    config: resolveConfig({ defaultTimeoutMs: 5_000, subagentName: "herdr" }),
    store: { find: async () => record },
    transports: {
      resolve: () => ({
        waitForAgent: async () => {
          calls.push("wait");
        },
        getAgent: async () => ({ status: "idle" }),
      }),
    },
    spawn: {
      spawn: async () => {
        calls.push("spawn");
        return started;
      },
    },
    harvest: {
      harvest: async () => {
        calls.push("harvest");
        return final;
      },
    },
    lifecycle: {
      interrupt: async () => {
        calls.push("interrupt");
      },
      close: async () => {
        calls.push("close");
      },
    },
  });
  return { provider, calls, record };
}

test("provider registers the configured name and conservative capabilities", () => {
  const { provider } = setup();
  assert.equal(provider.name, "herdr");
  assert.equal(provider.inheritsParentContext, false);
  assert.deepEqual(provider.capabilities, {
    agentOptions: false,
    agentPreset: false,
    outputSchema: false,
    depthLimit: false,
  });
});

test("an immediately completed spawn resolves without waiting", async () => {
  const { provider, calls } = setup({ started: agentResult() });
  const run = await provider.start({ prompt: "do it", cwd: "/repo" });
  assert.equal(run.id, "t1");
  const result = await run.result;
  assert.equal(result.stopReason, "stop");
  assert.deepEqual(result.output, [{ type: "text", text: "the answer" }]);
  assert.deepEqual(calls, ["spawn"]);
});

test("a running spawn waits, harvests, and resolves the final text", async () => {
  const { provider, calls } = setup();
  const run = await provider.start({ prompt: "do it", cwd: "/repo" });
  const result = await run.result;
  assert.equal(result.stopReason, "stop");
  assert.deepEqual(result.output, [{ type: "text", text: "the answer" }]);
  assert.deepEqual(calls, ["spawn", "wait", "harvest"]);
});

test("a blocked child becomes an error terminal carrying the question", async () => {
  const { provider } = setup({
    final: agentResult({
      status: "blocked",
      summary: "blocked",
      finalMessage: undefined,
      blocked: { question: "Allow network?", tail: "" },
      nextAction: "answer",
    }),
  });
  const run = await provider.start({ prompt: "do it", cwd: "/repo" });
  const result = await run.result;
  assert.equal(result.stopReason, "error");
  assert.match(result.output[0].text, /Allow network\?/);
});

test("dispose interrupts and closes the owned task", async () => {
  const { provider, calls } = setup({ started: agentResult() });
  const run = await provider.start({ prompt: "do it", cwd: "/repo" });
  await run.result;
  await run.dispose();
  assert.deepEqual(calls, ["spawn", "interrupt", "close"]);
});

test("toTerminal covers failed, gone, and interrupted states", () => {
  assert.equal(
    toTerminal(agentResult({ status: "failed", error: { code: "X", message: "boom" } })).stopReason,
    "error",
  );
  assert.equal(toTerminal(agentResult({ status: "gone" })).stopReason, "error");
  assert.equal(toTerminal(agentResult({ status: "interrupted" })).stopReason, "aborted");
  assert.deepEqual(
    toTerminal(
      agentResult({
        status: "completed",
        finalMessage: undefined,
        result: { path: "p", text: "body", meta: {} },
      }),
    ).output,
    [{ type: "text", text: "body" }],
  );
});
