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
  
  const requiredConfig: Array<[keyof OpenGaussConfig, string]> = [
    ['user', 'OPENGAUSS_USER'],
    ['password', 'OPENGAUSS_PASSWORD'],
    ['host', 'OPENGAUSS_HOST'],
    ['database', 'OPENGAUSS_DATABASE'],
  ];
  
  const missingKeys = requiredConfig.filter(([key]) => !config[key]);

  if (missingKeys.length > 0) {
    const readableKeys = missingKeys.map(([, env]) => env).join('、');
    console.warn(
      `缺少数据库配置 ${readableKeys}，服务器仍会启动，但相关工具可能因配置缺失而失败`
    );
  }
  
  const server = createServer();
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  
  console.error('openGauss MCP Server 已启动');
}



