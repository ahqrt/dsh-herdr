import test from "node:test";
import assert from "node:assert/strict";
import {
  artifactPaths,
  buildTaskPrompt,
  buildAgentMessage,
  buildReviewFindings,
} from "../lib/domain/prompt.js";
import { parseResultMarkdown, firstLine } from "../lib/domain/result-md.js";

const dir = "/tmp/herdr-task-1";

test("buildTaskPrompt states the artifact contract and the completion line", () => {
  const text = buildTaskPrompt({
    taskId: "t1",
    role: "worker",
    prompt: "Add a retry to the HTTP client.",
    cwd: "/repo",
    artifactDir: dir,
    timeoutMs: 60_000,
    kind: "pi",
  });
  assert.match(text, /\[DSH-HERDR TASK t1\]/);
  assert.match(text, /role: worker/);
  assert.match(text, new RegExp(`${dir}/result.md`));
  assert.match(text, /COMPLETE .*result\.md/);
  assert.match(text, /inbox\.ndjson/);
  assert.match(text, /Do not edit files outside \/repo/);
  assert.match(text, /Implement the objective/);
});

test("a reviewer prompt is read-only and mandates the finding format", () => {
  const text = buildTaskPrompt({
    taskId: "t2",
    role: "reviewer",
    prompt: "Review the diff.",
    cwd: "/repo",
    artifactDir: dir,
    timeoutMs: 60_000,
    kind: "pi",
  });
  assert.match(text, /role: reviewer/);
  assert.match(text, /read-only/);
  assert.match(text, /\[severity\] path:line/);
  assert.match(text, /UNSURE/);
});

test("artifactPaths keeps every artifact outside the repo", () => {
  const paths = artifactPaths("/tmp/x/t1");
  assert.equal(paths.result, "/tmp/x/t1/result.md");
  assert.equal(paths.diff, "/tmp/x/t1/diff.patch");
});

test("parseResultMarkdown reads the frontmatter subset", () => {
  const md = [
    "---",
    "status: completed",
    "summary: added retry with jitter",
    "tests: npm test (42 passed)",
    "files: src/http.ts, src/http.test.ts",
    "---",
    "Detail body here.",
  ].join("\n");
  const { meta, body } = parseResultMarkdown(md);
  assert.equal(meta.status, "completed");
  assert.equal(meta.summary, "added retry with jitter");
  assert.equal(meta.tests, "npm test (42 passed)");
  assert.equal(body, "Detail body here.");
});

test("parseResultMarkdown passes through plain markdown", () => {
  const { meta, body } = parseResultMarkdown("# hi\nbody");
  assert.deepEqual(meta, {});
  assert.equal(body, "# hi\nbody");
});

test("buildAgentMessage frames from/to", () => {
  const msg = buildAgentMessage({ from: "dsh:orchestrator", to: "worker-1", text: "hello" });
  assert.match(msg, /<agent-message from="dsh:orchestrator" to="worker-1">/);
  assert.match(msg, /hello/);
  assert.match(msg, /<\/agent-message>/);
});

test("buildReviewFindings carries the round and the findings", () => {
  const text = buildReviewFindings("[MAJOR] src/a.ts:10 — off by one — boundary — test", 2);
  assert.match(text, /REVIEW_FINDINGS round 2/);
  assert.match(text, /BLOCKER and MAJOR/);
  assert.match(text, /\[MAJOR\]/);
});

test("firstLine skips empty lines and frontmatter fences", () => {
  assert.equal(firstLine("\n---\nhello\nworld"), "hello");
  assert.equal(firstLine("x".repeat(300)).length, 160);
});
