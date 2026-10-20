import { type AliasSummary } from "../domain/aliases.js";
import { type Paths } from "../domain/paths.js";
import type { PluginConfig } from "../defaults.js";
import type { HerdrTransport } from "../ports/transport.js";
export type CheckStatus = "ok" | "warn" | "fail";
export interface DoctorCheck {
    status: CheckStatus;
    label: string;
    detail: string;
}
export interface DoctorReport {
    ok: boolean;
    checks: DoctorCheck[];
    next: string[];
    aliases: AliasSummary[];
    runtime: {
        node: string;
        platform: string;
        topology: string;
        inHerdrPane: boolean;
    };
}
export interface DoctorDeps {
    transport: HerdrTransport;
    config: PluginConfig;
    paths: Paths;
    env: NodeJS.ProcessEnv;
}
export declare class DoctorService {
    private readonly deps;
    constructor(deps: DoctorDeps);
    run(): Promise<DoctorReport>;
}
//# sourceMappingURL=doctor.d.ts.map