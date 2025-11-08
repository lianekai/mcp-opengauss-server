import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConfig } from '../config.js';
import { withConnection } from '../utils/db.js';
import {
  normalizeIdentifier,
  validateTableName,
  ValidationError,
} from '../utils/validation.js';

const describeTableInputSchema = {
  table: z.string().min(1, 'table 不能为空').describe('表名'),
  schema: z
    .string()
    .optional()
    .describe('数据库 Schema，默认为配置中的 OPENGAUSS_SCHEMA'),
};

const describeTableSchema = z.object(describeTableInputSchema);
type DescribeTableParams = z.infer<typeof describeTableSchema>;

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export function registerDescribeTableTool(server: McpServer): void {
  server.registerTool(
    'describe_table',
    {
      title: '描述表结构',
      description: '返回表的列信息（列名、类型、是否可空等）',
      inputSchema: describeTableInputSchema,
    },
    async ({ table, schema }: DescribeTableParams) => {
      const effectiveSchema = schema ?? getConfig().schema;
      
      try {
        validateTableName(table);
        const normalizedSchema = normalizeIdentifier(effectiveSchema);
        const normalizedTable = normalizeIdentifier(table);
        
        const rows = await withConnection(async (client) => {
          // openGauss 使用 PostgreSQL 的 information_schema
          const sql = `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length,
              numeric_precision,
              numeric_scale
            FROM information_schema.columns
            WHERE table_schema = $1 AND table_name = $2
            ORDER BY ordinal_position
          `;
          
          const result = await client.query(sql, [
            normalizedSchema,
            normalizedTable,
          ]);
          
          return result.rows as ColumnInfo[];
        });

        if (rows.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: `表 ${normalizedSchema}.${normalizedTable} 不存在`,
              },
            ],
          };
        }

        // 格式化输出
        const lines = rows.map((row) => {
          let typeInfo = row.data_type;
          
          if (row.character_maximum_length) {
            typeInfo += `(${row.character_maximum_length})`;
          } else if (row.numeric_precision && row.numeric_scale !== null) {
            typeInfo += `(${row.numeric_precision},${row.numeric_scale})`;
          } else if (row.numeric_precision) {
            typeInfo += `(${row.numeric_precision})`;
          }
          
          const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultValue = row.column_default
            ? `DEFAULT ${row.column_default}`
            : '';
          
          return `${row.column_name}\t${typeInfo}\t${nullable}\t${defaultValue}`.trim();
        });

        const header = 'COLUMN_NAME\tDATA_TYPE\tNULLABLE\tDEFAULT';
        const text = [header, ...lines].join('\n');

        return {
          content: [
            {
              type: 'text' as const,
              text,
            },
          ],
          structuredContent: {
            table: `${normalizedSchema}.${normalizedTable}`,
            columns: rows,
          },
        };
      } catch (error) {
        const message =
          error instanceof ValidationError || error instanceof Error
            ? error.message
            : '描述表结构时发生未知错误';
        
        return {
          isError: true,
          content: [{ type: 'text' as const, text: message }],
        };
      }
    }
  );
}



