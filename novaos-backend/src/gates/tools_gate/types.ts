// ═══════════════════════════════════════════════════════════════════════════════
// TOOLS GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ToolsRoute = 'tools' | 'skip';

export interface ToolsGateOutput {
  route: ToolsRoute;
  external_tool: boolean;
}
