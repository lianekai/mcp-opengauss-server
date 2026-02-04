import { shouldShowVersion } from './config.js';
import { startServer } from './server.js';
import pkg from '../package.json' with { type: 'json' };

export async function main(): Promise<void> {
  if (shouldShowVersion()) {
    // stdio MCP 模式下 stdout 是协议通道，避免污染输出；仅在 TTY 下输出到 stdout。
    const msg = `mcp-opengauss-server v${pkg.version}`;
    if (process.stdout.isTTY) {
      console.log(msg);
    } else {
      console.error(msg);
    }
    process.exit(0);
  }
  
  try {
    await startServer();
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

void main();


























