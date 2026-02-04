import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { withConnection } from '../utils/db.js';
import { ValidationError } from '../utils/validation.js';

const listSlowQueriesInputSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .optional()
    .describe('返回的最大慢查询数（1-100，默认 20）'),
  min_duration_ms: z
    .number()
    .min(0)
    .default(1000)
    .optional()
    .describe('最小执行时间（毫秒），只返回超过此时间的查询（默认 1000ms）'),
  use_pg_stat_statements: z
    .boolean()
    .default(false)
    .optional()
    .describe('是否使用 pg_stat_statements 扩展（如果可用，提供更详细的统计信息）'),
};

const listSlowQueriesSchema = z.object(listSlowQueriesInputSchema);
type ListSlowQueriesParams = z.infer<typeof listSlowQueriesSchema>;

interface SlowQueryInfo {
  pid?: number;
  query?: string;
  duration_ms?: number;
  calls?: number;
  mean_exec_time?: number;
  max_exec_time?: number;
  total_exec_time?: number;
  query_start?: string;
}

export function registerListSlowQueriesTool(server: McpServer): void {
  server.registerTool(
    'opengauss_list_slow_queries',
    {
      title: '列出 openGauss 慢查询',
      description: '查询当前正在执行或最近执行过的慢查询。可以基于当前活动连接或 pg_stat_statements 扩展（如果可用）获取慢查询信息。用于性能分析和优化。',
      inputSchema: listSlowQueriesInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ limit = 20, min_duration_ms = 1000, use_pg_stat_statements = false }: ListSlowQueriesParams) => {
      try {
        let rows: SlowQueryInfo[] = [];

        if (use_pg_stat_statements) {
          // 尝试使用 pg_stat_statements 扩展
          try {
            rows = await withConnection(async (client) => {
              // 检查扩展是否可用
              const extCheck = await client.query(
                `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as exists`
              );
              
              if (!extCheck.rows[0]?.exists) {
                throw new Error('pg_stat_statements 扩展未安装');
              }

              const sql = `
                SELECT 
                  query,
                  calls,
                  mean_exec_time as mean_exec_time_ms,
                  max_exec_time as max_exec_time_ms,
                  total_exec_time as total_exec_time_ms
                FROM pg_stat_statements
                WHERE mean_exec_time >= $1
                ORDER BY mean_exec_time DESC
                LIMIT $2
              `;

              const result = await client.query(sql, [min_duration_ms, limit]);
              return result.rows.map((row: any) => ({
                query: row.query?.substring(0, 500) || '',
                calls: row.calls,
                mean_exec_time: row.mean_exec_time_ms,
                max_exec_time: row.max_exec_time_ms,
                total_exec_time: row.total_exec_time_ms,
              }));
            });
          } catch (error) {
            // 如果 pg_stat_statements 不可用，回退到活动连接查询
            if (error instanceof Error && error.message.includes('pg_stat_statements')) {
              // 继续使用活动连接查询
            } else {
              throw error;
            }
          }
        }

        // 如果 pg_stat_statements 不可用或未启用，使用活动连接查询
        if (rows.length === 0) {
          rows = await withConnection(async (client) => {
            const sql = `
              SELECT 
                pid,
                query,
                EXTRACT(EPOCH FROM (NOW() - query_start)) * 1000 as duration_ms,
                query_start
              FROM pg_stat_activity
              WHERE datname = current_database()
                AND state = 'active'
                AND query IS NOT NULL
                AND query NOT LIKE '%pg_stat_activity%'
                AND EXTRACT(EPOCH FROM (NOW() - query_start)) * 1000 >= $1
              ORDER BY query_start
              LIMIT $2
            `;

            const result = await client.query(sql, [min_duration_ms, limit]);
            return result.rows.map((row: any) => ({
              pid: row.pid,
              query: row.query?.substring(0, 500) || '',
              duration_ms: Math.round(row.duration_ms),
              query_start: row.query_start,
            }));
          });
        }

        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `未找到执行时间超过 ${min_duration_ms}ms 的慢查询`,
              },
            ],
            structuredContent: {
              total: 0,
              min_duration_ms,
              queries: [],
            },
          };
        }

        // 格式化输出
        const lines = rows.map((row, index) => {
          const parts = [`[${index + 1}]`];
          
          if (row.pid) {
            parts.push(`PID: ${row.pid}`);
          }
          
          if (row.duration_ms !== undefined) {
            parts.push(`Duration: ${row.duration_ms}ms`);
          }
          
          if (row.mean_exec_time !== undefined) {
            parts.push(`Mean: ${row.mean_exec_time.toFixed(2)}ms`);
          }
          
          if (row.calls !== undefined) {
            parts.push(`Calls: ${row.calls}`);
          }
          
          if (row.query) {
            const queryPreview = row.query.length > 100 
              ? row.query.substring(0, 100) + '...' 
              : row.query;
            parts.push(`Query: ${queryPreview}`);
          }
          
          return parts.join(' | ');
        });

        const header = `找到 ${rows.length} 个慢查询（最小执行时间: ${min_duration_ms}ms）`;
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
            min_duration_ms,
            limit,
            queries: rows,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '查询慢查询信息时发生未知错误';

        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}
