import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { withConnection } from '../utils/db.js';
import { normalizeIdentifier, ValidationError } from '../utils/validation.js';

const listTablesInputSchema = {
  schema: z
    .string()
    .optional()
    .describe('数据库 Schema，默认为配置中的 OPENGAUSS_SCHEMA'),
};

const listTablesSchema = z.object(listTablesInputSchema);
type ListTablesParams = z.infer<typeof listTablesSchema>;

export function registerListTablesTool(server: McpServer): void {
  server.registerTool(
    'list_tables',
    {
      title: '列出数据库中的所有表',
      description: '返回指定 Schema 下的所有表名',
      inputSchema: listTablesInputSchema,
    },
    async ({ schema }: ListTablesParams) => {
      const effectiveSchema = schema ?? getConfig().schema;
      
      try {
        const normalizedSchema = normalizeIdentifier(effectiveSchema);
        
        const rows = await withConnection(async (client) => {
          // openGauss 使用 PostgreSQL 的系统视图 pg_tables
          const sql = `
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = $1 
            ORDER BY tablename
          `;
          
          const result = await client.query(sql, [normalizedSchema]);
          return result.rows as Array<{ tablename: string }>;
        });

        const tables = rows.map((row) => row.tablename).join(', ');
        
        return {
          content: [
            {
              type: 'text' as const,
              text: tables || `Schema ${normalizedSchema} 下未找到任何表`,
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '列出表时发生未知错误';
        
        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}



