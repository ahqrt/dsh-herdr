import test from "node:test";
import assert from "node:assert/strict";
import { registerSubagentProvider } from "../lib/services/subagent-registration.js";

const provider = { name: "herdr" };

test("dynamic inject registers the provider when the service appears", () => {
  const status = { name: "herdr", registered: false };
  let seen;
  let registered;
  registerSubagentProvider(
    {
      inject(deps, callback) {
        seen = deps;
        callback({ subagents: { registerProvider: (value) => (registered = value) } });
      },
    },
    provider,
    status,
  );
  assert.deepEqual(seen, ["subagents"]);
  assert.equal(status.registered, true);
});

test("a present service is used when inject is unavailable", () => {
  const status = { name: "herdr", registered: false };
  let registered;
  registerSubagentProvider(
    {
      get(name) {
        return name === "subagents"
          ? { registerProvider: (value) => (registered = value) }
          : undefined;
      },
    },
    provider,
    status,
  );
  assert.equal(status.registered, true);
  assert.equal(registered, provider);
});

test("a missing service is reported, not thrown", () => {
  const status = { name: "herdr", registered: false };
  registerSubagentProvider({ get: () => undefined }, provider, status);
  assert.equal(status.registered, false);
  assert.match(status.error, /not loaded/);
});

test("a duplicate provider name is reported", () => {
  const status = { name: "herdr", registered: false };
  registerSubagentProvider(
    {
      get: () => ({
        registerProvider() {
          throw new Error('a subagent provider named "herdr" is already registered');
        },
      }),
    },
    provider,
    status,
  );
  assert.equal(status.registered, false);
  assert.match(status.error, /already registered/);
});
