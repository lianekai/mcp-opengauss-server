import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { getConfig } from '../config.js';
import { registerDescribeTableTool } from './describeTable.js';
import { registerExecuteQueryTool } from './executeQuery.js';
import { registerExecuteWriteTool } from './executeWrite.js';
import { registerExplainQueryTool } from './explainQuery.js';
import { registerListConnectionsTool } from './listConnections.js';
import { registerListSlowQueriesTool } from './listSlowQueries.js';
import { registerListTablesTool } from './listTables.js';
import { registerProfileQueryTool } from './profileQuery.js';

export function registerTools(server: McpServer): void {
  // 基础只读工具（始终可用）
  registerListTablesTool(server);
  registerExecuteQueryTool(server);
  registerDescribeTableTool(server);
  
  // 性能优化工具（只读）
  registerExplainQueryTool(server);
  registerProfileQueryTool(server);
  registerListConnectionsTool(server);
  registerListSlowQueriesTool(server);
  
  // 写入工具（需要配置开启）
  const config = getConfig();
  if (config.enableWrite) {
    registerExecuteWriteTool(server);
  }
}

