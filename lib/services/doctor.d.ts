import { type AliasSummary } from "../domain/aliases.js";
import { type Paths } from "../domain/paths.js";
import type { PluginConfig } from "../defaults.js";
import type { TransportPool } from "../ports/transports.js";
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
        machines: string[];
        transport: string;
    };
}
export interface DoctorDeps {
    transports: TransportPool;
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