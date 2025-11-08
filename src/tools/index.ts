import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListTablesTool } from './listTables.js';
import { registerExecuteQueryTool } from './executeQuery.js';
import { registerDescribeTableTool } from './describeTable.js';

/**
 * 注册所有工具到 MCP 服务器
 */
export function registerTools(server: McpServer): void {
  registerListTablesTool(server);
  registerExecuteQueryTool(server);
  registerDescribeTableTool(server);
}



