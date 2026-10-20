import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  parseAliasTable,
  parseModelSpec,
  resolveModelSpec,
} from "../lib/domain/aliases.js";

const TABLE = `
# 模型别名

| 别名 | \`--model\` | 计费 | thinking |
|---|---|---|---|
| \`grok4.7\` | \`xai/grok-4.7\` | xAI 订阅 | high / medium / low |
| \`opus5\`（\`claude\`） | \`tokenadvent-claude/claude-opus-5\` | tokenadvent 付费 API（$5/$25 每 M） | high / medium |
| \`flash\`（默认） | \`commandcode/deepseek/deepseek-v4.1-flash\` | commandcode credits | max / high / low |
`;

test("parseAliasTable extracts alias, model, billing, thinking", () => {
  const aliases = parseAliasTable(TABLE);
  assert.equal(aliases.size, 3);
  assert.deepEqual(aliases.get("grok4.7"), {
    alias: "grok4.7",
    model: "xai/grok-4.7",
    billing: "xAI 订阅",
    thinking: ["high", "medium", "low"],
  });
  assert.equal(aliases.get("opus5").model, "tokenadvent-claude/claude-opus-5");
  assert.equal(aliases.get("flash").model, "commandcode/deepseek/deepseek-v4.1-flash");
});

test("parseAliasTable ignores headers, separators, and non-model rows", () => {
  const aliases = parseAliasTable("| a | b |\n|---|---|\n| `x` | not-a-model | n | m |");
  assert.equal(aliases.size, 0);
});

test("parseModelSpec splits alias and [thinking]", () => {
  assert.deepEqual(parseModelSpec("grok4.7"), { alias: "grok4.7" });
  assert.deepEqual(parseModelSpec("grok4.7[high]"), { alias: "grok4.7", thinking: "high" });
  assert.deepEqual(parseModelSpec("xai/grok-4.7"), { rawModel: "xai/grok-4.7" });
  assert.deepEqual(parseModelSpec("xai/grok-4.7[low]"), { rawModel: "xai/grok-4.7", thinking: "low" });
  assert.deepEqual(parseModelSpec(""), {});
});

test("resolveModelSpec resolves aliases, raw ids, fallback, and errors", () => {
  const aliases = parseAliasTable(TABLE);
  assert.deepEqual(resolveModelSpec("grok4.7[high]", aliases), {
    model: "xai/grok-4.7",
    thinking: "high",
    alias: "grok4.7",
  });
  assert.deepEqual(resolveModelSpec("xai/grok-4.7", aliases), {
    model: "xai/grok-4.7",
  });
  assert.deepEqual(resolveModelSpec("", aliases, "flash"), {
    model: "commandcode/deepseek/deepseek-v4.1-flash",
    alias: "flash",
  });

  const unknown = resolveModelSpec("nope", aliases);
  assert.match(unknown.error, /unknown model alias "nope"/);
  assert.match(unknown.error, /known aliases/);

  const badThinking = resolveModelSpec("grok4.7[extreme]", aliases);
  assert.match(badThinking.error, /unknown thinking level/);
});

test("the user's real alias file, when present, parses consistently", (t) => {
  const path = join(homedir(), ".pi", "agent", "model-aliases.md");
  if (!existsSync(path)) return t.skip("no local alias file");
  const aliases = parseAliasTable(readFileSync(path, "utf8"));
  assert.ok(aliases.size >= 1);
  assert.ok([...aliases.values()].every((a) => a.model.includes("/")));
});
