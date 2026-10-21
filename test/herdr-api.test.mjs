import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHerdrApi } from "../lib/server/herdr-api.js";

function request(url, headers = {}) {
  return { url, method: "GET", headers };
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

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-api-"));
  const taskId = "t1";
  const artifactDir = join(dir, "tasks", taskId);
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
  writeFileSync(
    join(dir, "session.jsonl"),
    JSON.stringify({
      type: "message",
      message: { role: "assistant", content: [{ type: "text", text: "final words" }] },
    }) + "\n",
    "utf8",
  );
  const api = createHerdrApi({
    store: {
      find: async (target) => (target === "t1" || target === "worker-a" ? record : undefined),
    },
    lifecycle: {
      list: async () => [{ owned: true, taskId, name: "worker-a", status: "completed" }],
    },
    runtimes: {
      resolve: async () => ({
        io: {
          readText: async (path) => {
            if (path.endsWith("result.md")) return "---\nstatus: completed\n---\nbody text";
            if (path.endsWith("session.jsonl")) return "not used";
            return undefined;
          },
        },
      }),
    },
    transports: {},
    paths: { artifactsRoot: join(dir, "artifacts") },
  });
  return { dir, taskId, record, api };
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
