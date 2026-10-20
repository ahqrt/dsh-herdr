import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = JSON.parse(
  readFileSync(join(process.cwd(), "schema", "agent-result.schema.json"), "utf8"),
);

test("the result schema is valid JSON with the documented required fields", () => {
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  for (const key of [
    "schemaVersion",
    "taskId",
    "status",
    "role",
    "agent",
    "summary",
    "timing",
    "nextAction",
  ]) {
    assert.ok(schema.required.includes(key), `missing required ${key}`);
  }
  assert.deepEqual(schema.properties.schemaVersion, { const: 1 });
  assert.ok(schema.properties.status.enum.includes("completed"));
  assert.ok(schema.properties.nextAction.enum.includes("answer"));
});

test("the package manifest points at the built entry and the bundle patch", () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  assert.equal(pkg.main, "./lib/index.js");
  assert.equal(pkg.types, "./lib/index.d.ts");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(pkg.dsh.compatibility.dsh, "0.2.1-rc.2");
  assert.ok(pkg.files.includes("lib"));
  assert.ok(pkg.files.includes("cordis.patch.yml"));
});
