import { shouldShowVersion } from './config.js';
import { startServer } from './server.js';
import pkg from '../package.json' with { type: 'json' };

// MCP 的 stdio 模式下，stdout 是 JSON-RPC 协议通道。
// 某些底层驱动会误用 console.log 输出调试信息（例如 Buffer salt），
// Codex 会把这类非 JSON 内容视为协议损坏并直接关闭 Transport。
// 因此在非 TTY 场景统一把 console.log 重定向到 stderr，避免污染 stdout。
if (!process.stdout.isTTY) {
  console.log = (...args: unknown[]): void => {
    console.error(...args);
  };
}

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

























