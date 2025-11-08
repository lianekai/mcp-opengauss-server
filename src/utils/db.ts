import { Client, type ClientConfig } from 'node-opengauss';
import { getConfig } from '../config.js';

/**
 * 创建 openGauss 数据库连接
 */
export async function createConnection(): Promise<Client> {
  const config = getConfig();
  
  const clientConfig: ClientConfig = {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  };

  const client = new Client(clientConfig);
  
  try {
    await client.connect();
    
    // 设置默认 schema (如果配置了)
    if (config.schema && config.schema !== 'public') {
      await client.query(`SET search_path TO ${config.schema}, public`);
    }
    
    return client;
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
  operation: (client: Client) => Promise<T>
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
export async function ensureSchema(client: Client, schema: string): Promise<void> {
  try {
    await client.query(`SET search_path TO ${schema}, public`);
  } catch (error) {
    throw new Error(
      `设置 schema 失败: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}



