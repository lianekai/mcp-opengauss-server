import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const OpenGauss = require('node-opengauss');

import { getConfig } from '../config.js';

type ClientConfig = {
  host: string;
  port: number;
  username: string;
  dbname: string;
  password: string;
};

/**
 * 包装 node-opengauss client 以提供 Promise-based API
 */
class PromiseClient {
  constructor(private client: any, private ogInstance: any) {}

  /**
   * 执行查询并返回 Promise
   * 支持参数化查询
   */
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      // 如果有参数，需要手动替换（node-opengauss 不直接支持参数化查询）
      let finalSql = sql;
      if (params && params.length > 0) {
        params.forEach((param, index) => {
          // 简单的参数替换，使用 $1, $2 等占位符
          const placeholder = `$${index + 1}`;
          // 转义字符串参数
          const value = typeof param === 'string' ? `'${param.replace(/'/g, "''")}'` : String(param);
          finalSql = finalSql.replace(placeholder, value);
        });
      }

      this.client.query(finalSql, (err: any, res: any) => {
        if (err) {
          reject(err);
        } else {
          // node-opengauss 返回格式可能不同，统一处理
          const result = {
            rows: res?.rows || [],
            rowCount: res?.affectedRows || res?.rows?.length || 0,
          };
          resolve(result);
        }
      });
    });
  }

  /**
   * 关闭连接
   */
  async end(): Promise<void> {
    if (this.client) {
      await this.client.end();
    }
  }
}

/**
 * 创建 openGauss 数据库连接
 * node-opengauss 使用 username/dbname 而不是 user/database
 */
export async function createConnection(): Promise<PromiseClient> {
  const config = getConfig();
  
  const clientConfig: ClientConfig = {
    host: config.host,
    port: config.port,
    username: config.user,      // node-opengauss 使用 username
    dbname: config.database,     // node-opengauss 使用 dbname
    password: config.password,
  };

  const og = new OpenGauss();
  
  try {
    const client = await og.connect(clientConfig);
    const promiseClient = new PromiseClient(client, og);
    
    // 设置默认 schema (如果配置了)
    if (config.schema && config.schema !== 'public') {
      await promiseClient.query(`SET search_path TO ${config.schema}, public`);
    }
    
    return promiseClient;
  } catch (error) {
    throw new Error(
      `连接 openGauss 数据库失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * 执行数据库操作的包装函数
 * 自动管理连接的创建和关闭
 */
export async function withConnection<T>(
  operation: (client: PromiseClient) => Promise<T>
): Promise<T> {
  const client = await createConnection();
  
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

/**
 * 确保 schema 存在
 */
export async function ensureSchema(client: PromiseClient, schema: string): Promise<void> {
  try {
    await client.query(`SET search_path TO ${schema}, public`);
  } catch (error) {
    throw new Error(
      `设置 schema 失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}




