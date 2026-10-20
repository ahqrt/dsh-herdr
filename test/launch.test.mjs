import test from "node:test";
import assert from "node:assert/strict";
import { buildAgentArgs, kindCaps } from "../lib/domain/launch.js";
import { makeAgentName } from "../lib/domain/ids.js";

test("pi accepts --model and --thinking", () => {
  const r = buildAgentArgs({
    kind: "pi",
    model: "xai/grok-4.7",
    thinking: "high",
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, ["--model", "xai/grok-4.7", "--thinking", "high"]);
});

test("pi without model emits no flags", () => {
  const r = buildAgentArgs({ kind: "pi" });
  assert.deepEqual(r.data, []);
});

test("agy refuses model and thinking", () => {
  const r = buildAgentArgs({ kind: "agy", model: "xai/grok-4.7" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /refuses --model/);
});

test("other kinds require the agent_args escape hatch", () => {
  const r = buildAgentArgs({ kind: "claude", model: "x" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /no model flag/);

  const withArgs = buildAgentArgs({ kind: "claude", agentArgs: ["--model", "opus"] });
  assert.deepEqual(withArgs.data, ["--model", "opus"]);
});

test("thinking is validated before launch", () => {
  const r = buildAgentArgs({ kind: "pi", thinking: "maximum" });
  assert.equal(r.ok, false);
  assert.match(r.error.message, /unknown thinking level/);
});

test("kindCaps is explicit about the three families", () => {
  assert.equal(kindCaps("pi").model, true);
  assert.equal(kindCaps("agy").refusesModel, true);
  assert.equal(kindCaps("codex").model, false);
});

test("makeAgentName produces a herdr-legal, unique name", () => {
  const taken = new Set();
  const a = makeAgentName({ role: "reviewer", flavor: "grok4.7", suffix: "ab12", taken });
  assert.equal(a, "reviewer-grok4-7-ab12");
  assert.match(a, /^[a-z][a-z0-9_-]{0,31}$/);
  taken.add(a);
  const b = makeAgentName({ role: "reviewer", flavor: "grok4.7", suffix: "cd34", taken });
  assert.notEqual(a, b);
});

test("makeAgentName survives unicode and empty input", () => {
  const name = makeAgentName({ role: "审阅", flavor: "模型", suffix: "ab12", taken: new Set() });
  assert.match(name, /^[a-z][a-z0-9_-]{0,31}$/);
  assert.equal(name, "worker-agent-ab12");
});
