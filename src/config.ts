import dotenv from 'dotenv';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ quiet: true });

export interface OpenGaussConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

const DEFAULT_PORT = '5432';
const DEFAULT_DATABASE = 'postgres';
const DEFAULT_SCHEMA = 'public';

const runtimeOverrides: Partial<OpenGaussConfig> = {};

const argv = yargs(hideBin(process.argv))
  .version(false)
  .option('user', { type: 'string', describe: '数据库用户名' })
  .option('password', { type: 'string', describe: '数据库密码' })
  .option('host', { type: 'string', describe: '数据库主机' })
  .option('port', { type: 'string', describe: '数据库端口', default: DEFAULT_PORT })
  .option('database', { type: 'string', describe: '数据库名称', default: DEFAULT_DATABASE })
  .option('schema', { type: 'string', describe: '默认 Schema', default: DEFAULT_SCHEMA })
  .option('version', { type: 'boolean', describe: '打印版本信息' })
  .help(false)
  .parseSync();

export function setConfig(partial: Partial<OpenGaussConfig>): void {
  Object.assign(runtimeOverrides, partial);
}

const env = process.env;

function resolveValue(key: keyof OpenGaussConfig, envKey: string, defaultValue?: string): string {
  return (
    runtimeOverrides[key]?.toString() ??
    (argv[key] as string | undefined) ??
    env[envKey] ??
    defaultValue ??
    ''
  );
}

export function getConfig(): OpenGaussConfig {
  return {
    host: resolveValue('host', 'OPENGAUSS_HOST', '127.0.0.1'),  // 使用 127.0.0.1 避免 IPv6 问题
    port: parseInt(resolveValue('port', 'OPENGAUSS_PORT', DEFAULT_PORT), 10),
    database: resolveValue('database', 'OPENGAUSS_DATABASE', DEFAULT_DATABASE),
    user: resolveValue('user', 'OPENGAUSS_USER'),
    password: resolveValue('password', 'OPENGAUSS_PASSWORD'),
    schema: resolveValue('schema', 'OPENGAUSS_SCHEMA', DEFAULT_SCHEMA),
  };
}

export function shouldShowVersion(): boolean {
  return Boolean(argv.version);
}




