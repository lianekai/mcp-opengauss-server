/**
 * 🔒 安全修复版本 - 数据库连接管理
 * 
 * 修复内容：
 * - ✅ 实现连接池（修复高危漏洞 #2）
 * - ✅ 修复 SQL 注入（修复高危漏洞 #1）
 * - ✅ 添加查询超时（修复中高危漏洞 #4）
 * - ✅ 添加连接重试机制（修复中危问题 #1）
 * - ✅ 改善错误处理（修复中危漏洞 #6）
 * - ✅ 添加连接池监控（修复中危问题 #5）
 * - ✅ 实现优雅关闭
 */

import { Pool, type PoolClient, type PoolConfig } from 'node-opengauss';
import { getConfig } from '../config.js';
import { normalizeIdentifier } from './validation.js';
import { logger } from './logger.js';

// ===========================
// 类型定义
// ===========================

export interface ConnectionOptions {
  timeout?: number;           // 查询超时（毫秒）
  retries?: number;          // 重试次数
  retryDelay?: number;       // 重试延迟（毫秒）
}

export interface PoolStats {
  totalConnections: number;
  idleConnections: number;
  activeConnections: number;
  waitingRequests: number;
}

// ===========================
// 连接池管理
// ===========================

let pool: Pool | null = null;
let isShuttingDown = false;

/**
 * 获取或创建连接池（单例模式）
 * 
 * ✅ 修复：使用连接池替代每次创建新连接
 */
export function getPool(): Pool {
  if (isShuttingDown) {
    throw new Error('服务器正在关闭，无法创建新连接');
  }

  if (!pool) {
    const config = getConfig();
    
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      
      // 连接池配置
      max: parseInt(process.env.CONNECTION_POOL_MAX || '20', 10),      // 最大连接数
      min: parseInt(process.env.CONNECTION_POOL_MIN || '2', 10),       // 最小连接数
      idleTimeoutMillis: 30000,           // 空闲连接30秒后释放
      connectionTimeoutMillis: 2000,      // 连接超时2秒
      
      // 额外安全配置
      application_name: 'mcp-opengauss-server',
    };

    pool = new Pool(poolConfig);

    // 错误处理
    pool.on('error', (err, client) => {
      logger.error({ err, client: client ? 'exists' : 'null' }, '连接池错误');
    });

    // 连接创建事件
    pool.on('connect', (client) => {
      logger.debug('新连接已创建');
    });

    // 连接移除事件
    pool.on('remove', (client) => {
      logger.debug('连接已从池中移除');
    });

    logger.info({
      max: poolConfig.max,
      min: poolConfig.min,
      host: config.host,
      database: config.database,
    }, '连接池已初始化');

    // 启动连接池监控
    startPoolMonitoring();
  }

  return pool;
}

/**
 * ✅ 新增：连接池统计
 */
export function getPoolStats(): PoolStats | null {
  if (!pool) {
    return null;
  }

  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    activeConnections: pool.totalCount - pool.idleCount,
    waitingRequests: pool.waitingCount,
  };
}

/**
 * ✅ 新增：连接池监控
 */
function startPoolMonitoring(): void {
  // 每分钟记录连接池状态
  setInterval(() => {
    const stats = getPoolStats();
    if (stats) {
      logger.info(stats, '连接池状态');
      
      // 告警：连接池接近耗尽
      if (stats.activeConnections >= (pool?.options.max ?? 20) * 0.9) {
        logger.warn(stats, '⚠️ 连接池使用率超过 90%');
      }
      
      // 告警：等待队列过长
      if (stats.waitingRequests > 10) {
        logger.warn(stats, '⚠️ 连接池等待队列过长');
      }
    }
  }, 60000);
}

/**
 * ✅ 修复：安全的 Schema 设置（防止 SQL 注入）
 */
async function setSearchPath(client: PoolClient, schema: string): Promise<void> {
  if (schema && schema !== 'public') {
    try {
      // ✅ 安全：先验证标识符，防止 SQL 注入
      const validatedSchema = normalizeIdentifier(schema);
      await client.query(`SET search_path TO ${validatedSchema}, public`);
      
      logger.debug({ schema: validatedSchema }, 'Search path 已设置');
    } catch (error) {
      logger.error({ error, schema }, '设置 search path 失败');
      throw new Error(
        `设置 schema 失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * ✅ 修复：带连接池的数据库操作包装函数
 * ✅ 新增：查询超时支持
 * ✅ 新增：重试机制
 */
export async function withConnection<T>(
  operation: (client: PoolClient) => Promise<T>,
  options: ConnectionOptions = {}
): Promise<T> {
  const {
    timeout = parseInt(process.env.QUERY_TIMEOUT || '30000', 10),
    retries = 0,
    retryDelay = 1000,
  } = options;

  const pool = getPool();
  let lastError: Error | null = null;

  // ✅ 新增：重试机制
  for (let attempt = 0; attempt <= retries; attempt++) {
    let client: PoolClient | null = null;
    
    try {
      // 从连接池获取连接
      client = await pool.connect();
      
      const config = getConfig();
      await setSearchPath(client, config.schema);
      
      // ✅ 新增：设置语句超时
      await client.query(`SET statement_timeout = ${timeout}`);
      
      // 执行操作
      const result = await operation(client);
      
      return result;
      
    } catch (error) {
      lastError = error as Error;
      
      // 判断是否应该重试
      const shouldRetry = attempt < retries && isRetryableError(error);
      
      if (shouldRetry) {
        const delay = retryDelay * (attempt + 1); // 指数退避
        logger.warn(
          { error, attempt: attempt + 1, delay },
          '数据库操作失败，准备重试'
        );
        await sleep(delay);
      } else {
        // 不重试或已达最大重试次数
        logger.error({ error, attempt }, '数据库操作失败');
        throw error;
      }
      
    } finally {
      // ✅ 修复：释放连接回连接池（而不是关闭）
      if (client) {
        client.release();
      }
    }
  }

  throw lastError || new Error('数据库操作失败');
}

/**
 * ✅ 新增：判断错误是否可重试
 */
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  
  // 可重试的错误类型
  const retryableErrors = [
    'connection timeout',
    'connection refused',
    'econnrefused',
    'network error',
    'etimedout',
    'connection reset',
  ];

  return retryableErrors.some(err => message.includes(err));
}

/**
 * 工具函数：延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ✅ 新增：健康检查
 */
export async function healthCheck(): Promise<{
  healthy: boolean;
  details: PoolStats | { error: string };
}> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      await client.query('SELECT 1');
      const stats = getPoolStats();
      
      return {
        healthy: true,
        details: stats || { error: 'No stats available' },
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error({ error }, '健康检查失败');
    return {
      healthy: false,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * ✅ 新增：优雅关闭
 */
export async function closePool(): Promise<void> {
  if (!pool) {
    return;
  }

  isShuttingDown = true;
  
  logger.info('正在关闭连接池...');
  
  try {
    await pool.end();
    pool = null;
    logger.info('连接池已关闭');
  } catch (error) {
    logger.error({ error }, '关闭连接池时出错');
    throw error;
  } finally {
    isShuttingDown = false;
  }
}

/**
 * ✅ 新增：注册优雅关闭处理器
 */
export function registerShutdownHandlers(): void {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
  
  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info({ signal }, '收到关闭信号');
      
      try {
        await closePool();
        process.exit(0);
      } catch (error) {
        logger.error({ error }, '优雅关闭失败');
        process.exit(1);
      }
    });
  });

  // 处理未捕获的异常
  process.on('uncaughtException', (error) => {
    logger.error({ error }, '未捕获的异常');
    closePool().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, '未处理的 Promise 拒绝');
    closePool().finally(() => process.exit(1));
  });
}

// ===========================
// 向后兼容的导出（已废弃）
// ===========================

/**
 * @deprecated 使用 withConnection 替代
 * 保留以确保向后兼容
 */
export async function createConnection(): Promise<PoolClient> {
  logger.warn('createConnection 已废弃，请使用 withConnection');
  const pool = getPool();
  return pool.connect();
}

/**
 * @deprecated 使用 setSearchPath 替代
 */
export async function ensureSchema(client: PoolClient, schema: string): Promise<void> {
  await setSearchPath(client, schema);
}

