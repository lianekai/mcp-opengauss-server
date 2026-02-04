import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { withConnection } from '../utils/db.js';
import { ValidationError } from '../utils/validation.js';

const listConnectionsInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .optional()
    .describe('返回的最大连接数（1-200，默认 50）'),
  state: z
    .enum(['active', 'idle', 'idle in transaction', 'all'])
    .default('all')
    .optional()
    .describe('连接状态过滤：active（活动）、idle（空闲）、idle in transaction（事务中空闲）、all（全部）'),
};

const listConnectionsSchema = z.object(listConnectionsInputSchema);
type ListConnectionsParams = z.infer<typeof listConnectionsSchema>;

interface ConnectionInfo {
  pid: number;
  datname: string;
  usename: string;
  application_name: string;
  client_addr: string | null;
  state: string;
  query: string | null;
  query_start: string | null;
  state_change: string | null;
  backend_start: string | null;
}

export function registerListConnectionsTool(server: McpServer): void {
  server.registerTool(
    'opengauss_list_connections',
    {
      title: '列出 openGauss 数据库连接',
      description: '查询当前数据库的所有连接信息，包括连接状态、执行的查询、客户端地址等。用于监控数据库连接和排查性能问题。',
      inputSchema: listConnectionsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit = 50, state = 'all' }: ListConnectionsParams) => {
      try {
        const rows = await withConnection(async (client) => {
          // openGauss 使用 PostgreSQL 的 pg_stat_activity 视图
          let sql = `
            SELECT 
              pid,
              datname,
              usename,
              application_name,
              client_addr,
              state,
              query,
              query_start,
              state_change,
              backend_start
            FROM pg_stat_activity
            WHERE datname = current_database()
          `;

          // 根据状态过滤
          if (state !== 'all') {
            sql += ` AND state = $1`;
          }

          sql += ` ORDER BY backend_start DESC LIMIT $${state !== 'all' ? '2' : '1'}`;

          const params = state !== 'all' ? [state, limit] : [limit];
          const result = await client.query(sql, params);

          return result.rows as ConnectionInfo[];
        });

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: '未找到符合条件的连接',
              },
            ],
            structuredContent: {
              total: 0,
              connections: [],
            },
          };
        }

        // 格式化输出
        const lines = rows.map((row) => {
          const parts = [
            `PID: ${row.pid}`,
            `Database: ${row.datname}`,
            `User: ${row.usename}`,
            `Application: ${row.application_name || 'N/A'}`,
            `Client: ${row.client_addr || 'N/A'}`,
            `State: ${row.state}`,
            row.query ? `Query: ${row.query.substring(0, 100)}${row.query.length > 100 ? '...' : ''}` : 'Query: N/A',
          ];
          return parts.join(' | ');
        });

        const header = `找到 ${rows.length} 个连接（状态: ${state}）`;
        const text = [header, '', ...lines].join('\n');

        return {
          content: [
            {
              type: 'text' as const,
              text,
            },
          ],
          structuredContent: {
            total: rows.length,
            state,
            limit,
            connections: rows,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '查询连接信息时发生未知错误';

        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}
