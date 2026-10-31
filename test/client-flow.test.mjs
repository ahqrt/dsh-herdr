import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/** Evaluate the pure flow helpers out of the client bundle. */
function loadFlowHelpers() {
  const source = readFileSync(new URL("../client/index.js", import.meta.url), "utf8");
  const start = source.indexOf("function shortClock");
  const end = source.indexOf("function buildPacket");
  assert.ok(start > 0 && end > start, "flow helpers not found");
  return new Function(
    `${source.slice(start, end)}; return { mergeFlow, formatFlowText, callLabel };`,
  )();
}

const message = (index, role = "assistant", text = `turn ${index}`) => ({
  index,
  role,
  text,
  toolCalls: [],
});

test("mergeFlow replaces on the first page and prepends earlier turns", () => {
  const { mergeFlow } = loadFlowHelpers();
  const page = { taskId: "t1", total: 300, prevFrom: 0, messages: [message(100), message(101)] };
  const first = mergeFlow(null, page, "replace");
  assert.deepEqual(
    first.messages.map((m) => m.index),
    [100, 101],
  );

  const earlier = mergeFlow(
    first,
    { taskId: "t1", total: 300, prevFrom: 0, messages: [message(98), message(99)] },
    "earlier",
  );
  assert.deepEqual(
    earlier.messages.map((m) => m.index),
    [98, 99, 100, 101],
  );
  assert.equal(earlier.prevFrom, 0);

  const overlapping = mergeFlow(
    earlier,
    { taskId: "t1", total: 300, prevFrom: 0, messages: [message(99), message(100)] },
    "earlier",
  );
  assert.deepEqual(
    overlapping.messages.map((m) => m.index),
    [98, 99, 100, 101],
  );
});

test("a tail refresh keeps turns loaded above the new page", () => {
  const { mergeFlow } = loadFlowHelpers();
  const previous = {
    taskId: "t1",
    total: 300,
    prevFrom: 0,
    messages: [message(100), message(101)],
  };
  const merged = mergeFlow(
    previous,
    { taskId: "t1", total: 302, prevFrom: 200, messages: [message(200), message(201)] },
    "tail",
  );
  assert.deepEqual(
    merged.messages.map((m) => m.index),
    [100, 101, 200, 201],
  );
  assert.equal(merged.prevFrom, 0, "the earliest loaded page stays addressable");
  assert.equal(merged.total, 302);

  const contiguous = mergeFlow(
    { taskId: "t1", total: 2, prevFrom: undefined, messages: [message(0), message(1)] },
    { taskId: "t1", total: 3, prevFrom: 0, messages: [message(1), message(2)] },
    "tail",
  );
  assert.deepEqual(
    contiguous.messages.map((m) => m.index),
    [0, 1, 2],
  );
});

test("formatFlowText renders tool calls, results and error flags", () => {
  const { formatFlowText } = loadFlowHelpers();
  const out = formatFlowText({
    taskId: "t1",
    sessionPath: "/sessions/t1.jsonl",
    total: 2,
    messages: [
      {
        index: 1,
        role: "assistant",
        text: "running tests",
        toolCalls: [{ name: "bash", detail: "npm test" }],
      },
      {
        index: 2,
        role: "tool",
        toolName: "bash",
        isError: true,
        durationMs: 1500,
        text: "boom",
        toolCalls: [],
      },
    ],
  });
  assert.match(out, /^# Transcript · t1 · 2 turn\(s\)/);
  assert.match(out, /session: \/sessions\/t1\.jsonl/);
  assert.match(out, /## \[1\] assistant/);
  assert.match(out, /- → bash npm test/);
  assert.match(out, /## \[2\] tool:bash \(error 1\.5s\)/);
  assert.match(out, /boom/);
});
