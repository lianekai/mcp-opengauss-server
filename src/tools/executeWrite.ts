import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { withConnection } from '../utils/db.js';
import {
  assertWriteQuery,
  quoteIdentifier,
  validateSchemaName,
  ValidationError,
} from '../utils/validation.fixed.js';
import {
  isWriteConfirmed,
  WRITE_CONFIRM_TOKEN,
  DANGEROUS_OPERATION_CONFIRM_TOKEN,
  getRequiredConfirmToken,
  getOperationTypeDescription,
  isDangerousOperation,
} from '../utils/writeConfirm.js';

const executeWriteInputSchema = {
  query: z.string().min(1, 'query 不能为空').describe('写入 SQL（仅允许 INSERT/UPDATE/DELETE，单语句）'),
  params: z
    .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional()
    .describe('可选参数数组（对应 $1, $2, ...）'),
  schema: z.string().optional().describe('数据库 Schema，默认为配置中的 OPENGAUSS_SCHEMA'),
  confirm: z
    .string()
    .optional()
    .describe(`写入确认：INSERT 操作需要 "${WRITE_CONFIRM_TOKEN}"，UPDATE/DELETE 操作需要 "${DANGEROUS_OPERATION_CONFIRM_TOKEN}"`),
};

const executeWriteSchema = z.object(executeWriteInputSchema);
type ExecuteWriteParams = z.infer<typeof executeWriteSchema>;

async function setEffectiveSchema(client: any, schema: string | undefined): Promise<string | undefined> {
  if (!schema) {
    return undefined;
  }
  const validated = validateSchemaName(schema);
  await client.query(`SET search_path TO ${quoteIdentifier(validated)}, public`);
  return validated;
}

export function registerExecuteWriteTool(server: McpServer): void {
  server.registerTool(
    'opengauss_execute_write',
    {
      title: '执行 openGauss 写入 SQL（可选启用）',
      description: `默认禁用；需配置 OPENGAUSS_ENABLE_WRITE=true 且提供确认参数才会执行。INSERT 需要 confirm="${WRITE_CONFIRM_TOKEN}"，UPDATE/DELETE 需要 confirm="${DANGEROUS_OPERATION_CONFIRM_TOKEN}"。仅允许 INSERT/UPDATE/DELETE 单语句。`,
      inputSchema: executeWriteInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ query, params, schema, confirm }: ExecuteWriteParams) => {
      const config = getConfig();
      const effectiveSchema = schema?.trim() || config.schema;

      try {
        if (!config.enableWrite) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: '写入能力默认禁用：请设置 OPENGAUSS_ENABLE_WRITE=true（或 CLI --enable-write）后再尝试。',
              },
            ],
          };
        }

        // 先验证查询格式
        assertWriteQuery(query);
        
        // 检测操作类型
        const operationType = getOperationTypeDescription(query);
        const isDangerous = isDangerousOperation(query);
        const requiredToken = getRequiredConfirmToken(query);
        
        // 验证确认参数
        if (!isWriteConfirmed(confirm, query)) {
          const errorMessage = isDangerous
            ? `⚠️ 危险操作（${operationType}）需要明确确认！\n\n` +
              `UPDATE 和 DELETE 操作会修改或删除数据，必须提供确认参数：\n` +
              `confirm="${DANGEROUS_OPERATION_CONFIRM_TOKEN}"\n\n` +
              `当前操作类型: ${operationType}\n` +
              `当前确认值: ${confirm || '(未提供)'}\n` +
              `所需确认值: "${requiredToken}"`
            : `写入操作需要明确确认：请传入 confirm="${WRITE_CONFIRM_TOKEN}"\n\n` +
              `当前操作类型: ${operationType}\n` +
              `当前确认值: ${confirm || '(未提供)'}\n` +
              `所需确认值: "${requiredToken}"`;
          
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: errorMessage,
              },
            ],
          };
        }

        const result = await withConnection(async (client) => {
          await setEffectiveSchema(client, effectiveSchema);
          return client.query(query, params ?? []);
        });

        const rowCount =
          typeof (result as any)?.rowCount === 'number'
            ? (result as any).rowCount
            : ((result as any)?.rows?.length ?? 0);

        const successMessage = isDangerous
          ? `✅ 危险操作执行成功（${operationType}）\n` +
            `受影响行数: ${rowCount}\n` +
            `操作类型: ${operationType}\n` +
            `Schema: ${validateSchemaName(effectiveSchema)}`
          : `✅ 写入执行成功（${operationType}）\n` +
            `受影响行数: ${rowCount}\n` +
            `操作类型: ${operationType}\n` +
            `Schema: ${validateSchemaName(effectiveSchema)}`;

        return {
          content: [
            {
              type: 'text' as const,
              text: successMessage,
            },
          ],
          structuredContent: {
            schema: validateSchemaName(effectiveSchema),
            operationType,
            rowCount,
            isDangerous,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '执行写入时发生未知错误';

        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}
