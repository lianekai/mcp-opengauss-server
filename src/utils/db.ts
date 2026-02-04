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
 * 创建 openGauss 数据库连接（底层实现）
 *
 * @apiNote
 * - node-opengauss 使用 username/dbname 而不是 user/database
 * - 这里仅负责建立连接并设置 search_path；连接复用/重连由上层管理
 */
async function createConnectionInternal(): Promise<PromiseClient> {
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
 * 进程级连接管理
 *
 * @apiNote
 * Codex 某些场景下对单次 tool call 的时间预算较紧；
 * 如果每次调用都新建连接，会导致请求在返回前 transport 被关闭。
 * 因此这里改为“进程级单例连接 + 简单互斥 + 失败自动重连（重试一次）”。
 */
let sharedClient: PromiseClient | null = null;
let connecting: Promise<PromiseClient> | null = null;
let closeHandlersRegistered = false;

// 简单互斥：避免并发 query 争用单连接导致驱动异常/结果串线。
let mutexTail: Promise<void> = Promise.resolve();

async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const prev = mutexTail;
  let release!: () => void;
  mutexTail = new Promise<void>((resolve) => {
    release = resolve;
  });

  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function registerCloseHandlersOnce(): void {
  if (closeHandlersRegistered) {
    return;
  }
  closeHandlersRegistered = true;

  const safeClose = async (): Promise<void> => {
    const client = sharedClient;
    sharedClient = null;
    connecting = null;
    if (!client) {
      return;
    }
    try {
      await client.end();
    } catch {
      // 忽略关闭异常：进程退出路径不应因关闭失败而阻塞。
    }
  };

  process.on('SIGINT', () => {
    void safeClose();
  });
  process.on('SIGTERM', () => {
    void safeClose();
  });
  process.on('beforeExit', () => {
    void safeClose();
  });
}

function isLikelyConnectionError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const message = error instanceof Error ? error.message : String(error);
  const upper = message.toUpperCase();

  return (
    upper.includes('ECONNREFUSED') ||
    upper.includes('ECONNRESET') ||
    upper.includes('EPIPE') ||
    upper.includes('BROKEN PIPE') ||
    upper.includes('CONNECTION') ||
    upper.includes('CONNECT') ||
    upper.includes('SOCKET') ||
    upper.includes('CLOSED') ||
    upper.includes('TERMINATED')
  );
}

async function getOrCreateSharedClient(): Promise<PromiseClient> {
  registerCloseHandlersOnce();

  if (sharedClient) {
    return sharedClient;
  }

  if (connecting) {
    return connecting;
  }

  connecting = (async () => {
    const client = await createConnectionInternal();
    sharedClient = client;
    return client;
  })().finally(() => {
    connecting = null;
  });

  return connecting;
}

async function resetSharedClient(): Promise<void> {
  const client = sharedClient;
  sharedClient = null;
  connecting = null;
  if (!client) {
    return;
  }
  try {
    await client.end();
  } catch {
    // 忽略
  }
}

/**
 * 主动关闭进程级连接
 *
 * @apiNote
 * stdio 传输断开时，如果仍保留数据库 socket，Node 进程可能不会自动退出，
 * 因此需要在 server 层监听 stdin 关闭并主动释放连接。
 */
export async function closeDbConnection(): Promise<void> {
  await resetSharedClient();
}

/**
 * 启动时预热连接（可选）
 *
 * @apiNote
 * 启动阶段尝试连接一次：成功则后续 tool call 基本无需再经历“建连耗时”；
 * 失败也不阻塞服务启动，工具调用时会按需重连。
 */
export async function initDbConnection(): Promise<void> {
  try {
    await getOrCreateSharedClient();
  } catch (error) {
    // 不能使用 stdout（stdio MCP 协议通道），因此用 stderr 输出诊断信息。
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[openGauss MCP] 启动预连接失败，将在工具调用时重试: ${msg}`);
  }
}

export async function withConnection<T>(
  operation: (client: PromiseClient) => Promise<T>
): Promise<T> {
  return runExclusive(async () => {
    const client = await getOrCreateSharedClient();
    try {
      return await operation(client);
    } catch (error) {
      // 连接异常时：重置连接并重试一次（满足“没连上就重新建一次”的诉求）。
      if (!isLikelyConnectionError(error)) {
        throw error;
      }

      await resetSharedClient();
      const retryClient = await getOrCreateSharedClient();
      return await operation(retryClient);
    }
  });
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


