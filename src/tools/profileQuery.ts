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

const profileQueryInputSchema = {
  query: z.string().min(1, 'query 不能为空').describe('只读 SQL 语句（用于 EXPLAIN ANALYZE）'),
  schema: z.string().optional().describe('数据库 Schema，默认为配置中的 OPENGAUSS_SCHEMA'),
  options: z
    .object({
      buffers: z.boolean().optional().describe('是否输出 BUFFERS'),
      verbose: z.boolean().optional().describe('是否输出 VERBOSE'),
      format: z.enum(['json', 'text']).optional().describe('输出格式（默认 json）'),
    })
    .optional()
    .describe('EXPLAIN 选项（ANALYZE 强制开启）'),
};

const profileQuerySchema = z.object(profileQueryInputSchema);
type ProfileQueryParams = z.infer<typeof profileQuerySchema>;

async function setEffectiveSchema(client: any, schema: string | undefined): Promise<string | undefined> {
  if (!schema) {
    return undefined;
  }
  const validated = validateSchemaName(schema);
  await client.query(`SET search_path TO ${quoteIdentifier(validated)}, public`);
  return validated;
}

export function registerProfileQueryTool(server: McpServer): void {
  server.registerTool(
    'opengauss_profile_query',
    {
      title: '分析 openGauss 查询耗时（EXPLAIN ANALYZE）',
      description: '对只读 SQL 执行 EXPLAIN (ANALYZE ...) 并提取 planning/execution time 等指标',
      inputSchema: profileQueryInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false, // EXPLAIN ANALYZE 会实际执行查询
        openWorldHint: false,
      },
    },
    async ({ query, schema, options }: ProfileQueryParams) => {
      const effectiveSchema = schema?.trim() || getConfig().schema;

      try {
        assertReadOnlyQuery(query);

        const { sql, format } = buildExplainSql(query, {
          analyze: true,
          buffers: options?.buffers,
          verbose: options?.verbose,
          format: options?.format,
        });

        const result = await withConnection(async (client) => {
          await setEffectiveSchema(client, effectiveSchema);
          return client.query(sql);
        });

        const rows = (result?.rows ?? []) as Array<Record<string, unknown>>;
        const jsonPlan = format === 'json' ? (rows[0]?.['QUERY PLAN'] ?? rows[0]?.['query_plan']) : undefined;
        const timings = format === 'json' ? extractExplainTimingsFromJsonPlan(jsonPlan) : {};

        const summaryParts: string[] = [];
        if (typeof timings.planningTimeMs === 'number') {
          summaryParts.push(`Planning Time: ${timings.planningTimeMs} ms`);
        }
        if (typeof timings.executionTimeMs === 'number') {
          summaryParts.push(`Execution Time: ${timings.executionTimeMs} ms`);
        }
        const summary = summaryParts.length > 0 ? summaryParts.join('\n') : '未能从计划中提取耗时信息';

        const planText =
          format === 'json'
            ? (() => {
                const raw = jsonPlan ?? rows[0];
                try {
                  return JSON.stringify(raw, null, 2);
                } catch {
                  return formatExplainResultText(rows);
                }
              })()
            : formatExplainResultText(rows);

        const text = `${summary}\n\n${planText}`.trim();

        return {
          content: [{ type: 'text' as const, text }],
          structuredContent: {
            schema: validateSchemaName(effectiveSchema),
            format,
            options: options ?? {},
            timings,
            summary,
            rows,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '分析查询耗时时发生未知错误';

        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}
