#!/usr/bin/env node
// Read-only live check against the Herdr on this machine. No pane is created.
//
//   pnpm build && node scripts/live-smoke.mjs
//
// Exit code 1 when the doctor reports a FAIL.

import { resolveConfig } from "../lib/defaults.js";
import { resolvePaths } from "../lib/domain/paths.js";
import { resolveHerdrBin, HerdrCli } from "../lib/adapters/herdr/cli.js";
import { HerdrCliTransport } from "../lib/adapters/herdr/transport.js";
import { DoctorService } from "../lib/services/doctor.js";
import { renderDoctor } from "../lib/tools/shared.js";

const config = resolveConfig({});
const paths = resolvePaths(config);
const cli = new HerdrCli(resolveHerdrBin(config.herdrBin));
const transport = new HerdrCliTransport(cli);
const doctor = new DoctorService({ transport, config, paths, env: process.env });

const report = await doctor.run();
console.log(renderDoctor(report)[0].text);

console.log("\n--- live agents ---");
const agents = await transport.listAgents().catch(() => []);
if (agents.length === 0) {
  console.log("(none)");
} else {
  for (const agent of agents) {
    console.log(
      `${(agent.name ?? "?").padEnd(24)} ${String(agent.status ?? "?").padEnd(9)} ${String(agent.kind ?? "?").padEnd(8)} ${agent.cwd ?? ""}`,
    );
  }
}

console.log("\nNo state was written and no pane was created.");
process.exit(report.ok ? 0 : 1);
