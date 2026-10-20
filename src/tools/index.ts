// Tool registry: the only place that knows the full public surface.

import type { DefineTool, ToolFactoryDeps } from "../host.js";
import { createSpawnTool } from "./spawn.js";
import { createResultTool } from "./result.js";
import { createMessageTool } from "./message.js";
import { createListTool } from "./list.js";
import { createCloseTool, createInterruptTool } from "./close.js";
import { createDoctorTool } from "./doctor.js";

export function createTools(deps: ToolFactoryDeps, defineTool: DefineTool): unknown[] {
  const options = { defineTool, deps };
  return [
    createSpawnTool(options),
    createResultTool(options),
    createMessageTool(options),
    createListTool(options),
    createCloseTool(options),
    createInterruptTool(options),
    createDoctorTool(options),
  ];
}

export const TOOL_NAMES = [
  "herdr_spawn_agent",
  "herdr_get_agent_result",
  "herdr_message_agent",
  "herdr_list_agents",
  "herdr_close_agent",
  "herdr_interrupt_agent",
  "herdr_doctor",
] as const;
