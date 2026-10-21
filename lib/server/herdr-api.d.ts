import type { IncomingMessage, ServerResponse } from "node:http";
import { type Paths } from "../domain/paths.js";
import type { MachineRuntimePool } from "../ports/machine.js";
import type { TaskStore } from "../ports/store.js";
import type { LifecycleService } from "../services/lifecycle.js";
export interface HerdrApiDeps {
    store: TaskStore;
    lifecycle: LifecycleService;
    runtimes: MachineRuntimePool;
    paths: Paths;
}
export declare function createHerdrApi(deps: HerdrApiDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
//# sourceMappingURL=herdr-api.d.ts.map