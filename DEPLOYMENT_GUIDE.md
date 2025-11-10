# 🚀 部署指南 - 安全加固版本

本指南帮助你将 mcp-opengauss-server 从当前版本（1.0.0）升级到安全加固版本（1.1.0）。

---

## 📋 部署前检查清单

- [ ] 已备份当前代码和数据库
- [ ] 已阅读安全修复指南（SECURITY_FIX_GUIDE.md）
- [ ] 已准备测试环境
- [ ] 已通知相关人员
- [ ] 已准备回滚方案

---

## 🔧 步骤 1: 备份当前版本

```bash
# 进入项目目录
cd /Users/your-name/software/mcp/mcp-opengauss-server

# 创建备份
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

echo "✅ 备份完成"
```

---

## 📦 步骤 2: 安装新依赖

```bash
# 安装新的依赖包
npm install pino pino-pretty

# 安装开发依赖
npm install --save-dev \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  @vitest/coverage-v8 \
  eslint \
  prettier

echo "✅ 依赖安装完成"
```

---

## 🔄 步骤 3: 应用安全修复

### 3.1 替换核心文件

```bash
# 替换数据库连接文件（连接池 + SQL 注入修复）
cp src/utils/db.fixed.ts src/utils/db.ts

# 替换验证文件（增强验证）
cp src/utils/validation.fixed.ts src/utils/validation.ts

echo "✅ 核心文件已更新"
```

### 3.2 添加新文件

```bash
# 这些文件已经创建，无需额外操作
# - src/utils/logger.ts
# - src/utils/rateLimit.ts

echo "✅ 新文件已就位"
```

---

## ⚙️ 步骤 4: 更新环境变量

编辑 `.env` 文件，添加新的配置项：

```bash
cat >> .env << 'EOF'

# ===========================
# 安全加固配置 (v1.1.0)
# ===========================

# 查询超时（毫秒）
QUERY_TIMEOUT=30000

# 速率限制（每分钟最大请求数）
RATE_LIMIT_MAX=100

# 连接池配置
CONNECTION_POOL_MAX=20
CONNECTION_POOL_MIN=2

# 日志级别 (debug, info, warn, error)
LOG_LEVEL=info

# 环境 (development, production)
NODE_ENV=production
EOF

echo "✅ 环境变量已更新"
```

---

## 🏗️ 步骤 5: 重新构建

```bash
# 清理旧的构建产物
rm -rf dist/

# 重新构建
npm run build

# 检查构建产物
ls -lh dist/

echo "✅ 构建完成"
```

---

## 🧪 步骤 6: 运行测试

```bash
# 运行所有测试
npm test

# 查看测试覆盖率
npm run test:coverage

# 运行安全审计
npm run security-audit

echo "✅ 测试通过"
```

---

## 🔍 步骤 7: 验证修复

### 7.1 验证 SQL 注入修复

```bash
# 测试恶意 schema 名称
OPENGAUSS_SCHEMA="public; DROP TABLE users; --" npm start
# 预期：应该抛出 ValidationError
```

### 7.2 验证连接池

```typescript
// 在代码中添加临时日志
import { getPoolStats } from './utils/db.js';

setInterval(() => {
  console.log('Pool Stats:', getPoolStats());
}, 5000);
```

### 7.3 验证速率限制

```bash
# 使用工具快速发送请求
for i in {1..150}; do
  curl -X POST http://localhost:3000/query &
done

# 预期：超过 100 个请求后应该被限制
```

---

## 📊 步骤 8: 监控和日志

### 8.1 启动服务

```bash
# 使用 PM2 管理（推荐）
npm install -g pm2
pm2 start npm --name "mcp-opengauss" -- start

# 查看日志
pm2 logs mcp-opengauss

# 或使用普通方式启动
npm start 2>&1 | tee logs/app.log
```

### 8.2 监控关键指标

```bash
# 检查连接池状态
tail -f logs/app.log | grep "连接池状态"

# 检查速率限制事件
tail -f logs/app.log | grep "rate_limit"

# 检查安全事件
tail -f logs/app.log | grep "安全事件"
```

---

## 🔐 步骤 9: 数据库用户权限加固

### 9.1 创建只读用户

```sql
-- 连接到 openGauss
gsql -d postgres -h localhost -U gaussdb

-- 创建只读用户
CREATE USER opengauss_readonly WITH PASSWORD 'strong_password_here';

-- 授予连接权限
GRANT CONNECT ON DATABASE your_database TO opengauss_readonly;

-- 授予 schema 使用权限
GRANT USAGE ON SCHEMA public TO opengauss_readonly;

-- 授予所有表的 SELECT 权限
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opengauss_readonly;

-- 确保未来创建的表也有权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
GRANT SELECT ON TABLES TO opengauss_readonly;

-- 限制连接数
ALTER USER opengauss_readonly CONNECTION LIMIT 10;

-- 验证权限
\du opengauss_readonly
```

### 9.2 更新 .env 使用只读用户

```bash
# 在 .env 中更新
OPENGAUSS_USER=opengauss_readonly
OPENGAUSS_PASSWORD=strong_password_here
```

---

## 🔥 步骤 10: 配置防火墙

### macOS (使用 pf)

```bash
# 编辑 pf 配置
sudo nano /etc/pf.conf

# 添加规则（只允许本地连接数据库）
block in proto tcp from any to any port 5432
pass in proto tcp from 127.0.0.1 to any port 5432

# 重新加载
sudo pfctl -f /etc/pf.conf
sudo pfctl -e
```

### Linux (使用 iptables)

```bash
# 只允许本地连接
sudo iptables -A INPUT -p tcp --dport 5432 -s 127.0.0.1 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 5432 -j DROP

# 保存规则
sudo iptables-save > /etc/iptables/rules.v4
```

---

## ✅ 步骤 11: 验收测试

### 11.1 功能测试

```bash
# 测试列出表
curl -X POST http://localhost:3000/tools/list_tables \
  -H "Content-Type: application/json" \
  -d '{"schema": "public"}'

# 测试执行查询
curl -X POST http://localhost:3000/tools/execute_query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT version()"}'

# 测试描述表
curl -X POST http://localhost:3000/tools/describe_table \
  -H "Content-Type: application/json" \
  -d '{"table": "users", "schema": "public"}'
```

### 11.2 安全测试

```bash
# 测试 SQL 注入防护（应该被拒绝）
curl -X POST http://localhost:3000/tools/execute_query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM users; DROP TABLE users;"}'

# 测试危险函数（应该被拒绝）
curl -X POST http://localhost:3000/tools/execute_query \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT pg_read_file(\"/etc/passwd\")"}'

# 测试速率限制（第 101 个请求应该被拒绝）
for i in {1..101}; do
  echo "Request $i"
  curl -X POST http://localhost:3000/tools/list_tables
done
```

---

## 📈 步骤 12: 性能基准测试

```bash
# 安装 Apache Bench
# macOS: brew install httpd
# Linux: sudo apt-get install apache2-utils

# 基准测试
ab -n 1000 -c 10 -p query.json -T application/json \
  http://localhost:3000/tools/list_tables

# 查询.json 示例
echo '{"schema": "public"}' > query.json
```

---

## 🔄 回滚方案

如果部署出现问题，按以下步骤回滚：

```bash
# 1. 停止服务
pm2 stop mcp-opengauss
# 或
killall node

# 2. 恢复备份
rm -rf src/
mv src.backup.YYYYMMDD_HHMMSS src/
cp package.json.backup package.json
cp package-lock.json.backup package-lock.json

# 3. 重新安装依赖
rm -rf node_modules/
npm install

# 4. 重新构建
npm run build

# 5. 重启服务
npm start
# 或
pm2 start mcp-opengauss
```

---

## 📋 验收标准

部署成功的标志：

- [ ] 所有测试通过（`npm test`）
- [ ] 安全审计通过（`npm run security-audit`）
- [ ] SQL 注入攻击被正确拒绝
- [ ] 速率限制正常工作
- [ ] 连接池正常工作（查看日志）
- [ ] 查询超时正常工作
- [ ] 日志正常记录
- [ ] 性能测试满足要求
- [ ] 监控指标正常
- [ ] 文档已更新

---

## 🚨 故障排查

### 问题 1: 构建失败

```bash
# 清理缓存
rm -rf node_modules/ dist/ package-lock.json
npm install
npm run build
```

### 问题 2: 测试失败

```bash
# 查看详细错误
npm test -- --reporter=verbose

# 单独运行失败的测试
npm test -- validation.test.ts
```

### 问题 3: 连接池错误

```bash
# 检查数据库连接
gsql -d postgres -h localhost -U opengauss_readonly

# 检查连接数
SELECT count(*) FROM pg_stat_activity WHERE usename = 'opengauss_readonly';
```

### 问题 4: 速率限制不工作

```bash
# 检查日志
grep "速率限制" logs/app.log

# 检查环境变量
echo $RATE_LIMIT_MAX
```

---

## 📞 支持

如遇问题，请：

1. 查看日志文件 `logs/app.log`
2. 运行诊断命令 `npm run security-audit`
3. 查阅安全修复指南 `SECURITY_FIX_GUIDE.md`
4. 联系技术支持

---

## 🎉 部署完成！

恭喜！你已经成功部署了安全加固版本的 mcp-opengauss-server。

**下一步建议**：
1. 持续监控日志和性能指标
2. 定期更新依赖包（`npm update`）
3. 定期进行安全审计
4. 考虑实施额外的安全措施（如 WAF、IDS 等）

