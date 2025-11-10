# 📝 MCP 客户端配置指南 - openGauss

本指南说明如何在各种 MCP 客户端中配置 mcp-opengauss-server，支持多种安装和配置方式。

---

## 🎯 三种配置方式

### 方式 1: 全局安装（推荐 - 本地开发包）

安装到全局 node_modules，通过命令名直接调用。**这是本地开发包的推荐方式。**

### 方式 2: 使用本地路径

直接指向项目的 dist 目录。适用于需要频繁修改代码的开发场景。

### 方式 3: 使用 npx（仅适用于 npm 发布的包）

从 npm 仓库下载并运行。**注意：本项目未发布到 npm，不能使用此方式。**

---

## 📦 准备工作

### 选项 A: 发布到 npm（公开或私有）

```bash
cd /Users/your-name/software/mcp/mcp-opengauss-server

# 1. 确保构建完成
npm run build

# 2. 发布到 npm
npm publish

# 如果是私有包
npm publish --access restricted
```

### 选项 B: 使用 npm link（本地开发）

```bash
cd /Users/your-name/software/mcp/mcp-opengauss-server

# 1. 构建项目
npm run build

# 2. 创建全局链接
npm link

# 验证链接
which mcp-opengauss
# 应该显示: /usr/local/bin/mcp-opengauss
```

### 选项 C: 全局安装（推荐 ⭐）

```bash
cd /Users/your-name/software/mcp/mcp-opengauss-server

# 1. 构建项目
npm run build

# 2. 全局安装
npm install -g .

# 验证安装
mcp-opengauss --version
# 应该显示: mcp-opengauss-server v1.1.0
```

---

## 🔧 MCP 客户端配置

### 1. Claude Desktop

**配置文件位置**: `~/Library/Application Support/Claude/claude_desktop_config.json`

#### 方式 1: 使用全局安装的命令（推荐 ⭐）

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "mcp-opengauss",
      "args": [
        "--host", "localhost",
        "--port", "5432",
        "--user", "postgres",
        "--password", "your_password",
        "--database", "mydb",
        "--schema", "public"
      ]
    }
  }
}
```

#### 方式 2: 使用本地路径

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "node",
      "args": [
        "/Users/your-name/software/mcp/mcp-opengauss-server/dist/index.js",
        "--host", "localhost",
        "--port", "5432",
        "--user", "postgres",
        "--password", "your_password",
        "--database", "mydb",
        "--schema", "public"
      ]
    }
  }
}
```

#### 方式 3: 混合使用（CLI 参数 + 环境变量）

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "mcp-opengauss",
      "args": [
        "--host", "localhost",
        "--port", "5432",
        "--database", "mydb"
      ],
      "env": {
        "OPENGAUSS_USER": "postgres",
        "OPENGAUSS_PASSWORD": "your_password",
        "OPENGAUSS_SCHEMA": "public"
      }
    }
  }
}
```

---

### 2. Cline (VSCode Extension)

**配置文件位置**: VSCode Settings → Cline → MCP Settings

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-opengauss-server",
        "--host", "localhost",
        "--port", "5432",
        "--user", "postgres",
        "--password", "your_password",
        "--database", "mydb",
        "--schema", "public"
      ]
    }
  }
}
```

---

### 3. mcp-router

**配置文件**: `~/.mcp-router/config.json`

```json
{
  "servers": {
    "opengauss": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-opengauss-server",
        "--host", "localhost",
        "--port", "5432",
        "--user", "postgres",
        "--password", "your_password",
        "--database", "mydb",
        "--schema", "public"
      ]
    }
  }
}
```

---

### 4. Zed Editor

**配置文件**: `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "opengauss": {
      "command": {
        "path": "npx",
        "args": [
          "-y",
          "mcp-opengauss-server",
          "--host", "localhost",
          "--port", "5432",
          "--user", "postgres",
          "--password", "your_password",
          "--database", "mydb",
          "--schema", "public"
        ]
      }
    }
  }
}
```

---

## 🔐 安全最佳实践

### 1. 避免在配置文件中明文存储密码

#### 方式 A: 使用环境变量文件

```bash
# 创建 ~/.opengauss_credentials
cat > ~/.opengauss_credentials << EOF
export OPENGAUSS_USER="postgres"
export OPENGAUSS_PASSWORD="your_secure_password"
export OPENGAUSS_SCHEMA="public"
EOF

# 设置权限
chmod 600 ~/.opengauss_credentials

# 在 shell 配置中加载（~/.zshrc 或 ~/.bashrc）
source ~/.opengauss_credentials
```

然后在 MCP 配置中使用环境变量：

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "mcp-opengauss",
      "args": [
        "--host", "localhost",
        "--port", "5432",
        "--database", "mydb"
      ]
    }
  }
}
```

#### 方式 B: 使用 .env 文件

在项目目录创建 `.env` 文件：

```bash
OPENGAUSS_HOST=localhost
OPENGAUSS_PORT=5432
OPENGAUSS_USER=postgres
OPENGAUSS_PASSWORD=your_secure_password
OPENGAUSS_DATABASE=mydb
OPENGAUSS_SCHEMA=public
```

然后使用本地路径方式启动：

```json
{
  "mcpServers": {
    "opengauss": {
      "command": "node",
      "args": [
        "/Users/your-name/software/mcp/mcp-opengauss-server/dist/index.js"
      ]
    }
  }
}
```

---

## 🎛️ 配置参数说明

### 必需参数

| 参数 | CLI | 环境变量 | 默认值 | 说明 |
|------|-----|----------|--------|------|
| 主机 | `--host` | `OPENGAUSS_HOST` | localhost | openGauss 服务器地址 |
| 端口 | `--port` | `OPENGAUSS_PORT` | 5432 | openGauss 服务器端口 |
| 用户名 | `--user` | `OPENGAUSS_USER` | 无 | 数据库用户名 |
| 密码 | `--password` | `OPENGAUSS_PASSWORD` | 无 | 数据库密码 |
| 数据库 | `--database` | `OPENGAUSS_DATABASE` | postgres | 数据库名称 |
| Schema | `--schema` | `OPENGAUSS_SCHEMA` | public | 默认 Schema |

### 可选参数

| 参数 | 说明 |
|------|------|
| `--version` | 显示版本号 |

---

## 🧪 测试配置

### 1. 测试本地安装

```bash
# 测试命令是否可用
mcp-opengauss --version

# 测试连接（会显示配置缺失提示）
mcp-opengauss

# 测试完整配置
mcp-opengauss \
  --host localhost \
  --port 5432 \
  --user postgres \
  --password your_password \
  --database mydb \
  --schema public
```

### 2. 测试 npx

```bash
npx -y mcp-opengauss-server --version

# 如果是本地链接
npx /Users/your-name/software/mcp/mcp-opengauss-server \
  --host localhost \
  --port 5432 \
  --user postgres \
  --password your_password \
  --database mydb \
  --schema public
```

---

## 📋 推荐配置方案

### 开发环境

**推荐**: 本地路径 + `.env` 文件

```json
{
  "mcpServers": {
    "opengauss-dev": {
      "command": "node",
      "args": [
        "/Users/your-name/software/mcp/mcp-opengauss-server/dist/index.js"
      ]
    }
  }
}
```

### 生产环境

**推荐**: npx + CLI 参数（或全局安装）

```json
{
  "mcpServers": {
    "opengauss-prod": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-opengauss-server",
        "--host", "prod-db.example.com",
        "--port", "5432",
        "--database", "production"
      ],
      "env": {
        "OPENGAUSS_USER": "readonly_user",
        "OPENGAUSS_PASSWORD": "secure_password",
        "OPENGAUSS_SCHEMA": "public"
      }
    }
  }
}
```

---

## 🔄 更新和维护

### 更新全局安装

```bash
cd /Users/your-name/software/mcp/mcp-opengauss-server
npm run build
npm install -g .
```

### 更新 npm link

```bash
cd /Users/your-name/software/mcp/mcp-opengauss-server
npm run build
# link 会自动使用最新的 dist
```

### 清理旧版本

```bash
# 查看当前安装的版本
npm list -g mcp-opengauss-server

# 卸载旧版本
npm uninstall -g mcp-opengauss-server

# 重新安装
npm install -g /Users/your-name/software/mcp/mcp-opengauss-server
```

---

## 🐛 故障排查

### 问题 1: "command not found: mcp-opengauss"

```bash
# 检查是否已全局安装
npm list -g mcp-opengauss-server

# 检查 PATH
echo $PATH

# 重新链接
npm link
```

### 问题 2: npx 找不到包

```bash
# 使用完整路径
npx /Users/your-name/software/mcp/mcp-opengauss-server

# 或者先发布到 npm
npm publish
```

### 问题 3: "缺少数据库配置" 警告

确保通过 CLI 参数或环境变量传递了所有必需配置：
- `--user` 或 `OPENGAUSS_USER`
- `--password` 或 `OPENGAUSS_PASSWORD`
- `--host` 或 `OPENGAUSS_HOST`
- `--schema` 或 `OPENGAUSS_SCHEMA`

### 问题 4: 连接失败

```bash
# 检查 openGauss 是否运行
ps aux | grep gaussdb

# 测试连接
gsql -h localhost -p 5432 -d mydb -U postgres

# 检查防火墙
sudo lsof -i :5432
```

---

## 💡 最佳实践总结

1. ✅ **使用 npm link 或全局安装**进行本地开发
2. ✅ **使用 npx** 进行无安装运行（需要发布到 npm）
3. ✅ **通过 CLI 参数传递敏感信息**（避免环境变量泄露）
4. ✅ **使用只读用户**连接数据库
5. ✅ **定期更新**到最新版本

---

## 🆚 与 PostgreSQL 的兼容性

openGauss 基于 PostgreSQL 开发，支持：
- ✅ PostgreSQL 协议
- ✅ libpq 接口
- ✅ 标准 SQL
- ✅ pg_tables 等系统视图
- ✅ information_schema

可以使用与 PostgreSQL 相同的连接方式和参数。

---

## 📚 相关文档

- [README.md](./README.md) - 项目说明
- [SECURITY_ANALYSIS_REPORT.md](./SECURITY_ANALYSIS_REPORT.md) - 安全分析
- [README_SECURITY_FIXES.md](./README_SECURITY_FIXES.md) - 安全修复

---

**更新时间**: 2025-11-10  
**版本**: 1.1.0

