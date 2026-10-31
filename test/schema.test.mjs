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
  assert.ok(pkg.files.includes("lib"));
  assert.ok(pkg.files.includes("cordis.patch.yml"));
});

function parseSemver(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value);
  assert.ok(match, `not a semver: ${value}`);
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ? match[4].split(".") : [],
  };
}

function compareIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return Number(left) - Number(right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  for (let i = 0; i < 3; i += 1) {
    if (a.core[i] !== b.core[i]) return a.core[i] - b.core[i];
  }
  // A release outranks its own prereleases (0.2.2 > 0.2.2-rc.1).
  if (a.pre.length === 0 || b.pre.length === 0) return b.pre.length - a.pre.length;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i += 1) {
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const order = compareIdentifier(a.pre[i], b.pre[i]);
    if (order !== 0) return order;
  }
  return 0;
}

test("the compatibility declaration is a channel range that admits every listed release", () => {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
  const declared = pkg.engines.dsh;
  assert.equal(
    pkg.dsh.compatibility.dsh,
    declared,
    "engines.dsh and dsh.compatibility.dsh must agree",
  );

  const match = /^>=(\S+) <(\S+)$/.exec(declared);
  assert.ok(match, `engines.dsh must be a ">=lower <upper" range, got ${declared}`);
  const [, lower, upper] = match;
  assert.equal(lower, "0.2.1-rc.2", "lower bound is the oldest supported rc");
  // The upper bound must exclude the next minor's prereleases: 0.2.2-rc.1 < 0.2.2.
  assert.equal(upper, "0.2.2-0", "upper bound must be 0.2.2-0, not 0.2.2 or a tilde range");
  assert.ok(compareSemver("0.2.2-rc.1", upper) > 0, "0.2.2-rc.1 must fall outside the range");

  const releases = Object.keys(pkg.dsh.compatibility.dshReleases);
  assert.ok(releases.length >= 1, "at least one release must be recorded as verified");
  for (const release of releases) {
    assert.ok(compareSemver(release, lower) >= 0, `${release} is below the lower bound`);
    assert.ok(compareSemver(release, upper) < 0, `${release} is outside the upper bound`);
  }
  assert.ok(releases.includes("0.2.1-rc.3"), "rc.3 must be recorded as preflight-verified");
});
