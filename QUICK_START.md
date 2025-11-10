# openGauss MCP Server 快速开始指南

## 前置要求

1. Node.js >= 16
2. 运行中的 openGauss 数据库实例
3. 有效的数据库连接凭据

## 快速开始

### 1. 配置数据库连接

创建 `.env` 文件：

```bash
cat > .env << EOF
OPENGAUSS_HOST=localhost
OPENGAUSS_PORT=5432
OPENGAUSS_DATABASE=postgres
OPENGAUSS_USER=gaussdb
OPENGAUSS_PASSWORD=yourpassword
OPENGAUSS_SCHEMA=public
EOF
```

### 2. 安装依赖（如果尚未安装）

```bash
npm install
```

### 3. 构建项目（如果尚未构建）

```bash
npm run build
```

### 4. 启动服务器

```bash
# 方式 1: 使用启动脚本
./start-opengauss.sh

# 方式 2: 使用 npm
npm start

# 方式 3: 开发模式（热重载）
npm run dev
```

## 在 Claude Desktop 中配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "node",
      "args": [
        "/Users/your-name/software/mcp/mcp-opengauss-server/dist/index.js"
      ],
      "env": {
        "OPENGAUSS_HOST": "localhost",
        "OPENGAUSS_PORT": "5432",
        "OPENGAUSS_DATABASE": "postgres",
        "OPENGAUSS_USER": "gaussdb",
        "OPENGAUSS_PASSWORD": "yourpassword",
        "OPENGAUSS_SCHEMA": "public"
      }
    }
  }
}
```

重启 Claude Desktop 以加载配置。

## 测试工具

### 1. 列出所有表

在 Claude 中询问：
```
"列出数据库中的所有表"
```

### 2. 查询数据

```
"查询 users 表的前 10 条记录"
```

### 3. 查看表结构

```
"描述 users 表的结构"
```

## 常见问题

### Q: 连接失败怎么办？

A: 检查以下几点：
1. openGauss 服务是否运行：`ps aux | grep gaussdb`
2. 端口是否正确（默认 5432）
3. 用户名和密码是否正确
4. 防火墙是否允许连接

### Q: 如何验证 openGauss 正在运行？

A: 使用 gsql 命令行工具：

```bash
gsql -d postgres -h localhost -U gaussdb -p 5432
```

### Q: 支持哪些 SQL 操作？

A: 仅支持只读操作：
- ✅ SELECT
- ✅ SHOW
- ✅ DESCRIBE
- ✅ EXPLAIN
- ✅ WITH (CTE)
- ❌ INSERT, UPDATE, DELETE
- ❌ CREATE, DROP, ALTER

### Q: 如何切换到不同的 schema？

A: 在工具调用中指定 `schema` 参数，或修改 `.env` 文件中的 `OPENGAUSS_SCHEMA`。

## 性能优化建议

1. **使用连接池**：对于高并发场景，可以修改 `db.ts` 以使用连接池
2. **限制结果集**：在查询中使用 `LIMIT` 子句
3. **创建索引**：为常用查询字段创建索引

## 安全建议

1. ✅ 使用只读数据库用户
2. ✅ 限制网络访问（防火墙规则）
3. ✅ 使用强密码
4. ✅ 定期更新依赖包
5. ✅ 不要在日志中记录敏感信息

## 下一步

- 查看 [README.md](README.md) 了解详细功能
- 探索 [src/tools/](src/tools/) 了解如何添加自定义工具
- 参考 [mcp-dm8-server](../mcp-dm8-server) 查看类似实现

## 获取帮助

如有问题，请：
1. 查看日志输出
2. 检查数据库连接配置
3. 参考 openGauss 官方文档
4. 提交 Issue 到项目仓库






