import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SetLevelRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import pkg from '../package.json' with { type: 'json' };
import type { OpenGaussConfig } from './config.js';
import { getConfig } from './config.js';
import { registerTools } from './tools/index.js';
import { closeDbConnection } from './utils/db.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'openGauss MCP Server',
    version: pkg.version ?? '0.0.0',
  });
  registerTools(server);

  // Codex/部分客户端会在初始化后探测 resources/prompts/logging 能力。
  // 如果 capability 未声明但客户端仍发送对应请求，SDK 会触发能力断言失败，
  // 某些客户端会直接关闭 transport（表现为 Transport closed / 超时）。
  // 这里显式启用空实现，保证兼容性：返回空列表 + 忽略 setLevel。

  // Codex 侧可能会主动探测 resources/list、resources/templates/list；
  // 若未启用 resources capability，会触发能力断言失败，导致客户端直接关闭 transport。
  // 这里显式启用资源相关 handler（即使暂不提供任何资源，也会返回空列表）。
  server.setResourceRequestHandlers();

  // 同理：prompts/list / prompts/get（不提供 prompt 也会返回空列表）
  server.setPromptRequestHandlers();

  // 同理：logging/setLevel（接受请求但不做任何事）
  server.server.registerCapabilities({ logging: {} });
  server.server.setRequestHandler(SetLevelRequestSchema, async () => ({}));

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

  // 不在启动时预热 DB 连接：node-opengauss 建连时可能向 stdout 写入，会污染 stdio JSON-RPC 流，
  // 导致客户端解析报 "Unexpected token '<', \"<Buffer ...>\" is not valid JSON"。首次工具调用时再建连即可。
  // void initDbConnection();

  // stdio 传输断开时（stdin close/end），主动关闭数据库连接并退出进程，
  // 避免“连接保持导致进程不退出”进而拖累客户端的下一次启动/重连。
  const shutdown = async (): Promise<void> => {
    try {
      await closeDbConnection();
    } finally {
      process.exit(0);
    }
  };

  process.stdin.on('close', () => {
    void shutdown();
  });
  process.stdin.on('end', () => {
    void shutdown();
  });
}
