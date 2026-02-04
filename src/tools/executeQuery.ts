import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { ensureSchema, withConnection } from '../utils/db.js';
import {
  assertReadOnlyQuery,
  normalizeIdentifier,
  ValidationError,
} from '../utils/validation.js';

const executeQueryInputSchema = {
  query: z.string().min(1, 'query 不能为空').describe('只读 SQL 语句'),
  schema: z
    .string()
    .optional()
    .describe('数据库 Schema，默认为配置中的 OPENGAUSS_SCHEMA'),
};

const executeQuerySchema = z.object(executeQueryInputSchema);
type ExecuteQueryParams = z.infer<typeof executeQuerySchema>;

export function registerExecuteQueryTool(server: McpServer): void {
  server.registerTool(
    'opengauss_execute_query',
    {
      title: '执行 openGauss 只读 SQL',
      description: '仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN 语句',
      inputSchema: executeQueryInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, schema }: ExecuteQueryParams) => {
      const effectiveSchema = schema ?? getConfig().schema;
      
      try {
        assertReadOnlyQuery(query);
        const normalizedSchema = normalizeIdentifier(effectiveSchema);
        
        const result = await withConnection(async (client) => {
          await ensureSchema(client, normalizedSchema);
          return client.query(query);
        });

        const rows = result.rows ?? [];
        const columns =
          result.fields?.map((field) => field.name) ??
          (rows.length > 0 ? Object.keys(rows[0] as Record<string, unknown>) : []);

        // 将单元格转为字符串；Buffer 不使用 Node 默认 "<Buffer ...>"，避免被误解析为 JSON 导致 "Unexpected token '<'"
        const cellToString = (value: unknown): string => {
          if (value == null) {
            return '';
          }
          if (Buffer.isBuffer(value)) {
            return '[BINARY]';
          }
          return String(value);
        };

        // 格式化为制表符分隔的文本
        const header = columns.join('\t');
        const dataLines = rows.map((row: Record<string, unknown>) =>
          columns.map((col) => cellToString(row[col])).join('\t')
        );
        const text = [header, ...dataLines].filter(Boolean).join('\n');

        // structuredContent 中也不保留 Buffer，避免序列化/解析异常
        const safeRows = rows.map((row: Record<string, unknown>) => {
          const out: Record<string, unknown> = {};
          for (const col of columns) {
            const v = row[col];
            out[col] = Buffer.isBuffer(v) ? '[BINARY]' : v;
          }
          return out;
        });

        return {
          content: [
            {
              type: 'text' as const,
              text: text || '查询无结果',
            },
          ],
          structuredContent: {
            columns,
            rows: safeRows,
            rowCount: result.rowCount ?? rows.length,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '执行查询时发生未知错误';
        
        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}




