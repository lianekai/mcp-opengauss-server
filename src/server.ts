import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import pkg from '../package.json' with { type: 'json' };
import type { OpenGaussConfig } from './config.js';
import { getConfig } from './config.js';
import { registerTools } from './tools/index.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'openGauss MCP Server',
    version: pkg.version ?? '0.0.0',
  });
  registerTools(server);
  return server;
}

export async function startServer(): Promise<void> {
  const config = getConfig();
  
  // 只在真正缺失配置时显示警告（通过 CLI 参数传递的不算缺失）
  const requiredConfig: Array<keyof OpenGaussConfig> = [
    'user',
    'password',
    'host',
    'schema',
  ];
  const missingKeys = requiredConfig.filter((key) => !config[key]);

  if (missingKeys.length > 0) {
    // 友好提示：可以通过 CLI 参数或环境变量配置
    console.warn(
      `[openGauss MCP] 缺少数据库配置: ${missingKeys.join(', ')}`
    );
    console.warn(
      `[openGauss MCP] 提示: 可通过环境变量配置，如: OPENGAUSS_USER=xxx OPENGAUSS_PASSWORD=xxx OPENGAUSS_HOST=localhost OPENGAUSS_SCHEMA=public`
    );
  }
  
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

