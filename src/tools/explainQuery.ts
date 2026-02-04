import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { withConnection } from '../utils/db.js';
import {
  assertReadOnlyQuery,
  quoteIdentifier,
  validateSchemaName,
  ValidationError,
} from '../utils/validation.fixed.js';
import {
  buildExplainSql,
  extractExplainTimingsFromJsonPlan,
  formatExplainResultText,
} from '../utils/explain.js';

const explainQueryInputSchema = {
  query: z.string().min(1, 'query 不能为空').describe('只读 SQL 语句（用于生成 EXPLAIN）'),
  schema: z.string().optional().describe('数据库 Schema，默认为配置中的 OPENGAUSS_SCHEMA'),
  options: z
    .object({
      analyze: z.boolean().optional().describe('是否执行 EXPLAIN ANALYZE（会实际执行查询）'),
      buffers: z.boolean().optional().describe('是否输出 BUFFERS'),
      verbose: z.boolean().optional().describe('是否输出 VERBOSE'),
      format: z.enum(['json', 'text']).optional().describe('输出格式（默认 json）'),
    })
    .optional()
    .describe('EXPLAIN 选项'),
};

const explainQuerySchema = z.object(explainQueryInputSchema);
type ExplainQueryParams = z.infer<typeof explainQuerySchema>;

async function setEffectiveSchema(client: any, schema: string | undefined): Promise<string | undefined> {
  if (!schema) {
    return undefined;
  }
  const validated = validateSchemaName(schema);
  await client.query(`SET search_path TO ${quoteIdentifier(validated)}, public`);
  return validated;
}

export function registerExplainQueryTool(server: McpServer): void {
  server.registerTool(
    'opengauss_explain_query',
    {
      title: '生成 openGauss 执行计划（EXPLAIN）',
      description: '对只读 SQL 生成 EXPLAIN 计划，默认 FORMAT JSON，可选 ANALYZE/BUFFERS/VERBOSE',
      inputSchema: explainQueryInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, schema, options }: ExplainQueryParams) => {
      const effectiveSchema = schema?.trim() || getConfig().schema;

      try {
        assertReadOnlyQuery(query);

        const { sql, format } = buildExplainSql(query, {
          analyze: options?.analyze,
          buffers: options?.buffers,
          verbose: options?.verbose,
          format: options?.format,
        });

        const result = await withConnection(async (client) => {
          await setEffectiveSchema(client, effectiveSchema);
          return client.query(sql);
        });

        const rows = (result?.rows ?? []) as Array<Record<string, unknown>>;
        const text =
          format === 'json'
            ? (() => {
                const raw = rows[0]?.['QUERY PLAN'] ?? rows[0]?.['query_plan'] ?? rows[0];
                try {
                  return JSON.stringify(raw, null, 2);
                } catch {
                  return formatExplainResultText(rows);
                }
              })()
            : formatExplainResultText(rows);

        const jsonPlan = format === 'json' ? (rows[0]?.['QUERY PLAN'] ?? rows[0]?.['query_plan']) : undefined;
        const timings = format === 'json' ? extractExplainTimingsFromJsonPlan(jsonPlan) : {};

        return {
          content: [{ type: 'text' as const, text }],
          structuredContent: {
            schema: validateSchemaName(effectiveSchema),
            format,
            options: options ?? {},
            timings,
            rows,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '生成执行计划时发生未知错误';

        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}
