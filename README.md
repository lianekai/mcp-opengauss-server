# MCP openGauss Server

一个用于 openGauss 数据库的 MCP (Model Context Protocol) 服务器，提供安全的只读数据库查询功能。

## 功能特性

- ✅ **安全的只读查询**：仅允许 SELECT、SHOW、DESCRIBE、EXPLAIN 等只读操作
- ✅ **完整的表管理**：列出表、查询表结构、执行自定义查询
- ✅ **openGauss 原生支持**：基于 `node-opengauss` 驱动，完全兼容 openGauss 特性
- ✅ **PostgreSQL 兼容**：利用 openGauss 对 PostgreSQL 的兼容性
- ✅ **类型安全**：使用 TypeScript 和 Zod 进行参数验证

## 安装

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
# openGauss 数据库配置
OPENGAUSS_HOST=localhost
OPENGAUSS_PORT=5432
OPENGAUSS_DATABASE=postgres
OPENGAUSS_USER=your_username
OPENGAUSS_PASSWORD=your_password
OPENGAUSS_SCHEMA=public
```

### 3. 构建项目

```bash
npm run build
```

## 使用方法

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

### 在 MCP 客户端中配置

在你的 MCP 客户端配置文件中添加：

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "node",
      "args": ["/path/to/mcp-opengauss-server/dist/index.js"],
      "env": {
        "OPENGAUSS_HOST": "localhost",
        "OPENGAUSS_PORT": "5432",
        "OPENGAUSS_DATABASE": "postgres",
        "OPENGAUSS_USER": "your_username",
        "OPENGAUSS_PASSWORD": "your_password",
        "OPENGAUSS_SCHEMA": "public"
      }
    }
  }
}
```

## 可用工具

### 1. list_tables

列出指定 schema 下的所有表。

**参数：**
- `schema` (可选): Schema 名称，默认使用配置中的 `OPENGAUSS_SCHEMA`

**示例：**
```json
{
  "schema": "public"
}
```

### 2. execute_query

执行只读 SQL 查询（SELECT、SHOW、DESCRIBE、EXPLAIN）。

**参数：**
- `query` (必需): SQL 查询语句
- `schema` (可选): Schema 名称

**示例：**
```json
{
  "query": "SELECT * FROM users WHERE id < 100 LIMIT 10",
  "schema": "public"
}
```

### 3. describe_table

获取表的详细结构信息（列名、数据类型、是否可空等）。

**参数：**
- `table` (必需): 表名
- `schema` (可选): Schema 名称

**示例：**
```json
{
  "table": "users",
  "schema": "public"
}
```

## 安全特性

### SQL 注入防护

- ✅ 严格的参数验证（仅允许字母、数字、下划线）
- ✅ 使用参数化查询（prepared statements）
- ✅ 标识符规范化

### 只读保护

- ✅ 拒绝 INSERT、UPDATE、DELETE、DROP 等写操作
- ✅ 拒绝 CREATE、ALTER、TRUNCATE 等 DDL 操作
- ✅ 拒绝 GRANT、REVOKE 等权限操作

## 技术栈

- **Runtime**: Node.js >= 16
- **Language**: TypeScript 5.x
- **Database Driver**: node-opengauss 7.x
- **MCP SDK**: @modelcontextprotocol/sdk 1.21+
- **Validation**: Zod 3.x

## 与 DM8 MCP Server 的差异

| 特性 | DM8 | openGauss |
|------|-----|-----------|
| 数据库驱动 | dmdb | node-opengauss |
| 系统表查询 | `ALL_TABLES` | `pg_tables` |
| 表结构查询 | DM8 特定视图 | `information_schema.columns` |
| 连接协议 | DM 原生协议 | PostgreSQL 协议 |
| 兼容模式 | - | A/B/PG 模式 |

## 故障排除

### 连接失败

1. 检查 openGauss 服务是否运行
2. 验证连接参数（主机、端口、用户名、密码）
3. 确认用户有访问数据库的权限
4. 检查防火墙设置

### Schema 不存在

确保配置的 schema 存在：

```sql
SELECT schema_name FROM information_schema.schemata;
```

### 权限不足

确保用户有查询权限：

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA public TO your_username;
```

## 开发

### 运行测试

```bash
npm test
```

### 代码检查

```bash
npm run lint
```

## 项目结构

```
mcp-opengauss-server/
├── src/
│   ├── config.ts              # 配置管理
│   ├── server.ts              # MCP 服务器
│   ├── index.ts               # 入口文件
│   ├── cli.ts                 # CLI 入口
│   ├── tools/
│   │   ├── index.ts           # 工具注册
│   │   ├── listTables.ts      # 列表工具
│   │   ├── executeQuery.ts    # 查询工具
│   │   └── describeTable.ts   # 表结构工具
│   └── utils/
│       ├── db.ts              # 数据库连接
│       └── validation.ts      # 验证工具
├── tests/                     # 测试文件
├── dist/                      # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## openGauss 特性说明

### 与 PostgreSQL 的兼容性

openGauss 基于 PostgreSQL 9.2.4 开发，保留了：
- ✅ libpq 协议兼容
- ✅ PostgreSQL 标准接口
- ✅ pg_tables、information_schema 等系统视图
- ✅ PSQL 客户端兼容

### 主要差异

尽管 openGauss 兼容 PostgreSQL，但在以下方面有所不同：
- 内核经过大量优化（约 74% 代码修改）
- 不支持表继承
- 特有的安全特性和性能优化
- 支持多种兼容模式（A/B/PG）

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 相关项目

- [mcp-dm8-server](../mcp-dm8-server) - DM8 数据库的 MCP 服务器
- [dm-mcp-server](../dm-mcp-server) - DM 数据库的 Go 实现

## 致谢

- openGauss 社区
- node-opengauss 项目
- Model Context Protocol (MCP) 项目



