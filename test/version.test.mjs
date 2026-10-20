import test from "node:test";
import assert from "node:assert/strict";
import {
  parseVersion,
  formatVersion,
  isAtLeast,
  floorError,
  MIN_HERDR_VERSION,
} from "../lib/domain/version.js";

test("parseVersion reads the first semver in a version line", () => {
  assert.deepEqual(parseVersion("herdr 0.9.4"), { major: 0, minor: 9, patch: 4 });
  assert.deepEqual(parseVersion("0.10.0-beta.2"), { major: 0, minor: 10, patch: 0 });
  assert.equal(parseVersion("no version here"), null);
});

test("formatVersion round-trips", () => {
  assert.equal(formatVersion(MIN_HERDR_VERSION), "0.9.0");
});

test("isAtLeast compares major then minor", () => {
  assert.equal(isAtLeast({ major: 0, minor: 9, patch: 4 }, 0, 9), true);
  assert.equal(isAtLeast({ major: 0, minor: 8, patch: 99 }, 0, 9), false);
  assert.equal(isAtLeast({ major: 1, minor: 0, patch: 0 }, 0, 9), true);
  assert.equal(isAtLeast(null, 0, 9), false);
});

test("floorError refuses old/unknown and lets missing through", () => {
  assert.equal(floorError({ state: "missing" }), null);
  assert.equal(floorError({ state: "ok", version: { major: 0, minor: 9, patch: 0 } }), null);

  const tooOld = floorError({ state: "ok", version: { major: 0, minor: 8, patch: 3 } });
  assert.equal(tooOld.ok, false);
  assert.equal(tooOld.error.code, "HERDR_TOO_OLD");
  assert.match(tooOld.error.message, /0\.8\.3/);

  const unknown = floorError({ state: "unknown" });
  assert.equal(unknown.error.code, "HERDR_TOO_OLD");
});
