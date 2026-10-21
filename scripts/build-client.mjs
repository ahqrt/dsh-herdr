// Copy the hand-written client plugin into lib/ (tsc does not touch it).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const source = join("client", "index.js");
execFileSync(process.execPath, ["--check", source]);
const target = join("lib", "client.js");
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log("client ->", target);
