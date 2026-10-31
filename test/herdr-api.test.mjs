import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { createHerdrApi } from "../lib/server/herdr-api.js";
import { TranscriptService } from "../lib/services/transcript.js";
import { HerdrError } from "../lib/domain/errors.js";

function request(url, headers = {}) {
  return { url, method: "GET", headers };
}

function postRequest(url, body, headers = {}) {
  return {
    url,
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    [Symbol.asyncIterator]: () =>
      Readable.from([Buffer.from(JSON.stringify(body))])[Symbol.asyncIterator](),
  };
}

function response() {
  const res = {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      res.status = status;
      res.headers = headers ?? {};
    },
    end(body) {
      res.body = String(body ?? "");
    },
  };
  return res;
}

const SESSION_TEXT = `${[
  { type: "message", message: { role: "user", content: "fix it" } },
  {
    type: "message",
    message: {
      role: "assistant",
      content: [
        { type: "text", text: "looking" },
        { type: "toolCall", name: "bash", arguments: { command: "npm test" } },
      ],
    },
  },
  {
    type: "message",
    message: {
      role: "toolResult",
      toolName: "bash",
      isError: false,
      durationMs: 1200,
      content: [{ type: "text", text: "pass" }],
    },
  },
]
  .map((entry) => JSON.stringify(entry))
  .join("\n")}\n`;

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-api-"));
  const taskId = "t1";
  const artifactDir = join(dir, "tasks", taskId);
  const calls = [];
  const record = {
    schemaVersion: 1,
    taskId,
    name: "worker-a",
    kind: "pi",
    model: "xai/grok-4.7",
    role: "worker",
    status: "completed",
    cwd: "/repo",
    artifactDir,
    paneId: "w1:p1",
    sessionPath: join(dir, "session.jsonl"),
    createdAt: 1,
    updatedAt: 2,
  };
  const blind = {
    schemaVersion: 1,
    taskId: "t2",
    name: "worker-b",
    kind: "agy",
    role: "worker",
    status: "failed",
    cwd: "/repo",
    artifactDir: join(dir, "tasks", "t2"),
    createdAt: 3,
    updatedAt: 4,
    error: "spawn failed: agent_not_ready",
  };
  const records = [record, blind];
  writeFileSync(join(dir, "session.jsonl"), SESSION_TEXT, "utf8");
  const store = {
    find: async (target) =>
      records.find((entry) => entry.taskId === target || entry.name === target),
  };
  const runtimes = {
    resolve: async () => ({
      io: {
        readText: async (path) => {
          if (path.endsWith("result.md"))
            return "---\nstatus: completed\nsummary: a short summary\n---\nbody text";
          if (path.endsWith("session.jsonl")) return SESSION_TEXT;
          return undefined;
        },
      },
    }),
  };
  const api = createHerdrApi({
    store,
    lifecycle: {
      list: async () => [{ owned: true, taskId, name: "worker-a", status: "completed" }],
      interrupt: async (target) => {
        if (target === "nope") throw new HerdrError("TASK_NOT_OWNED", "not owned");
        calls.push({ action: "interrupt", target });
        return { interrupted: true, message: "sent Escape" };
      },
      close: async (input) => {
        calls.push({ action: "close", ...input });
        return { closed: true, message: "closed" };
      },
    },
    runtimes,
    transcript: new TranscriptService(store, runtimes),
    reveal: {
      reveal: async (target) => ({ revealed: true, cwd: "/repo", message: `revealed ${target}` }),
      editorEnabled: () => true,
      openEditor: async (target) => ({ revealed: true, cwd: "/repo", message: `opened ${target}` }),
    },
    transports: {
      resolve: () => ({
        getAgent: async (target) =>
          target === "wV:p2"
            ? { name: "wV:p2", paneId: "wV:p2", status: "idle", kind: "pi" }
            : undefined,
        readAgent: async () => "live tail line",
      }),
    },
    paths: { artifactsRoot: join(dir, "artifacts") },
  });
  return { dir, taskId, record, blind, api, calls };
}

test("health and fleet answer with JSON envelopes", async () => {
  const { dir, api } = setup();
  try {
    const health = response();
    await api(request("/herdr/api/health"), health);
    assert.equal(health.status, 200);
    assert.deepEqual(JSON.parse(health.body), { ok: true, service: "dsh-herdr", version: 1 });

    const fleet = response();
    await api(request("/herdr/api/fleet"), fleet);
    assert.equal(JSON.parse(fleet.body).agents[0].taskId, "t1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("task detail returns result, final message, and diff", async () => {
  const { dir, taskId, api } = setup();
  try {
    const artifacts = join(dir, "artifacts", taskId);
    const { mkdirSync } = await import("node:fs");
    mkdirSync(artifacts, { recursive: true });
    writeFileSync(join(artifacts, "diff.patch"), "+added line\n", "utf8");

    const res = response();
    await api(request(`/herdr/api/task?target=${taskId}`), res);
    assert.equal(res.status, 200);
    const task = JSON.parse(res.body).task;
    assert.equal(task.name, "worker-a");
    assert.equal(task.summary, "a short summary");
    assert.equal(task.editorEnabled, true);
    assert.match(task.result.text, /body text/);
    assert.match(task.diff.text, /\+added line/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("unknown tasks are 404 and cross-origin reads are 403", async () => {
  const { dir, api } = setup();
  try {
    const missing = response();
    await api(request("/herdr/api/task?target=nope"), missing);
    assert.equal(missing.status, 404);

    const cross = response();
    await api(
      request("/herdr/api/fleet", { origin: "https://evil.example", host: "dsh.local" }),
      cross,
    );
    assert.equal(cross.status, 403);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("panel actions require the panel header and reuse ownership errors", async () => {
  const { dir, taskId, api, calls } = setup();
  try {
    const missing = response();
    await api(postRequest("/herdr/api/action", { action: "interrupt", target: taskId }), missing);
    assert.equal(missing.status, 403);

    const interrupt = response();
    await api(
      postRequest(
        "/herdr/api/action",
        { action: "interrupt", target: taskId },
        { "x-herdr-panel": "1" },
      ),
      interrupt,
    );
    assert.equal(interrupt.status, 200);
    assert.deepEqual(JSON.parse(interrupt.body).result, {
      interrupted: true,
      message: "sent Escape",
    });

    const close = response();
    await api(
      postRequest(
        "/herdr/api/action",
        { action: "close", target: taskId, force: true },
        { "x-herdr-panel": "1" },
      ),
      close,
    );
    assert.equal(close.status, 200);
    assert.equal(calls.at(-1).force, true);

    const unowned = response();
    await api(
      postRequest(
        "/herdr/api/action",
        { action: "interrupt", target: "nope" },
        { "x-herdr-panel": "1" },
      ),
      unowned,
    );
    assert.equal(unowned.status, 403);
    assert.match(JSON.parse(unowned.body).error, /not owned/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("live pane tails are read-only and 404 unknown agents", async () => {
  const { dir, api } = setup();
  try {
    const live = response();
    await api(request("/herdr/api/live?target=wV:p2"), live);
    assert.equal(live.status, 200);
    assert.equal(JSON.parse(live.body).live.tail.text, "live tail line");
    assert.equal(JSON.parse(live.body).live.name, "wV:p2");

    const missing = response();
    await api(request("/herdr/api/live?target=nope"), missing);
    assert.equal(missing.status, 404);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("transcript pages a pi session and the tail keeps the newest turns", async () => {
  const { dir, taskId, api } = setup();
  try {
    const head = response();
    await api(request(`/herdr/api/transcript?target=${taskId}&from=0&limit=2`), head);
    assert.equal(head.status, 200);
    const first = JSON.parse(head.body).transcript;
    assert.equal(first.total, 3);
    assert.deepEqual(
      first.messages.map((message) => message.index),
      [0, 1],
    );
    assert.equal(first.nextFrom, 2);
    assert.equal(first.prevFrom, undefined);
    assert.deepEqual(first.messages[1].toolCalls, [{ name: "bash", detail: "npm test" }]);

    const tail = response();
    await api(request(`/herdr/api/transcript?target=${taskId}&tail=1&limit=2`), tail);
    const last = JSON.parse(tail.body).transcript;
    assert.deepEqual(
      last.messages.map((message) => message.index),
      [1, 2],
    );
    assert.equal(last.prevFrom, 0);
    assert.equal(last.nextFrom, undefined);
    assert.equal(last.messages[1].role, "tool");
    assert.equal(last.messages[1].toolName, "bash");
    assert.equal(last.messages[1].durationMs, 1200);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a task without a pi session reports NO_TRANSCRIPT", async () => {
  const { dir, api } = setup();
  try {
    const res = response();
    await api(request("/herdr/api/transcript?target=t2"), res);
    assert.equal(res.status, 409);
    assert.equal(JSON.parse(res.body).code, "NO_TRANSCRIPT");

    const missing = response();
    await api(request("/herdr/api/transcript?target=nope"), missing);
    assert.equal(missing.status, 404);
    assert.equal(JSON.parse(missing.body).code, "TASK_NOT_FOUND");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("task detail exposes the recorded spawn error", async () => {
  const { dir, api } = setup();
  try {
    const res = response();
    await api(request("/herdr/api/task?target=t2"), res);
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(res.body).task.error, "spawn failed: agent_not_ready");
    assert.equal(JSON.parse(res.body).task.status, "failed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
