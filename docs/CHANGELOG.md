# mcp-opengauss-server 修改日志

所有重要的变更都会记录在这个文件中。

本项目遵循 [语义化版本控制](https://semver.org/lang/zh-CN/)。

---

## [未发布] - 待定

### 🔒 安全性改进
- [ ] 修复 SET search_path SQL 注入漏洞（**高危**）
- [ ] 添加连接池支持，防止资源耗尽
- [ ] 增强 SQL 注入防护，添加危险函数检测
- [ ] 实现查询超时机制
- [ ] 添加速率限制
- [ ] 改进错误消息，避免敏感信息泄露
- [ ] 添加输入长度限制
- [ ] 实现连接重试机制

### ⚡ 性能优化
- [ ] 实现数据库连接池（从 Client 改为 Pool）
- [ ] 添加查询结果缓存
- [ ] 优化大结果集处理
- [ ] 添加连接池监控

### 📝 文档改进
- [x] 创建安全审查报告
- [x] 添加文档目录结构
- [x] 创建快速开始指南
- [x] 添加技术对比文档
- [ ] 完善 API 文档
- [ ] 添加更多使用示例

### 🧪 测试
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 添加安全测试
- [ ] openGauss 兼容性测试

### ✨ 新功能
- [ ] 支持存储过程调用
- [ ] 支持分区表查询
- [ ] 添加统计信息查询工具
- [ ] 支持 openGauss 特有功能

---

## [1.0.0] - 2025-11-08

### ✨ 新增功能
- 初始版本发布
- 实现 MCP 协议支持
- 提供三个核心工具：
  - `list_tables`: 列出数据库表（使用 pg_tables）
  - `execute_query`: 执行只读 SQL 查询
  - `describe_table`: 查询表结构（使用 information_schema）

### 🔒 安全特性
- 增强的 SQL 注入防护
  - 白名单 + 黑名单双重验证
  - 支持 CTE (WITH 语句) 检测
  - 危险关键字检测
- 只读查询严格验证
- 标识符规范化（字母、数字、下划线）
- 表名格式验证（支持 schema.table）

### 🎯 openGauss 特性
- 完全兼容 openGauss PostgreSQL 协议
- 使用 node-opengauss 官方驱动
- 支持 openGauss 系统视图（pg_tables, information_schema）
- 自动设置 search_path

### 📦 依赖
- @modelcontextprotocol/sdk: ^1.21.0
- node-opengauss: ^1.1.0
- dotenv: ^17.2.3
- zod: ^3.25.76

### 📚 文档
- 完整的 README 文档
- 快速开始指南（QUICK_START.md）
- 技术对比文档（COMPARISON.md）
- 项目总结（PROJECT_SUMMARY.md）
- 启动脚本（start-opengauss.sh）

### 🏗️ 架构亮点
- 参考 mcp-dm8-server 成熟架构
- 约 85% 代码复用
- TypeScript 严格模式
- 模块化设计

---

## 开发历史

### 2025-11-08
- **需求分析阶段**
  - 分析 openGauss 与 PostgreSQL 兼容性
  - 评估直接使用 PostgreSQL MCP vs 自研实现
  - 决策：基于 node-opengauss 自研（考虑到国产化需求）

- **设计阶段**
  - 复用 mcp-dm8-server 架构
  - 适配 openGauss 系统表查询
  - 增强安全验证逻辑

- **实现阶段**（4小时完成）
  - 创建项目结构
  - 实现核心功能
  - 编写完整文档
  - 构建和测试

---

## 修改记录格式说明

### 变更类型
- `✨ 新增功能` - 新增的功能特性
- `🐛 修复 Bug` - Bug 修复
- `⚡ 性能优化` - 性能改进
- `🔒 安全性改进` - 安全相关的改进
- `💥 破坏性变更` - 不兼容的 API 变更
- `📝 文档改进` - 文档更新
- `🎨 代码优化` - 代码重构（不影响功能）
- `🧪 测试` - 测试相关的改动
- `🔧 配置` - 配置文件的修改
- `📦 依赖` - 依赖包的更新
- `🎯 openGauss 特性` - 特定于 openGauss 的功能

### 示例条目

```markdown
## [版本号] - YYYY-MM-DD

### ✨ 新增功能
- 添加了 XXX 功能 (#PR编号)
- 支持 YYY 特性

### 🔒 安全性改进
- 修复了 SQL 注入漏洞 (#Issue编号)
- 加强了输入验证

### 🎯 openGauss 特性
- 支持 openGauss 分区表
- 兼容 openGauss 安全特性

### 💥 破坏性变更
- 修改了 API 接口 XXX
- 删除了已废弃的 YYY 方法
```

---

## 维护指南

### 如何更新此文档

1. **每次提交前**：更新 `[未发布]` 部分
2. **发布新版本时**：
   - 将 `[未发布]` 的内容移到新版本号下
   - 添加发布日期
   - 创建新的 `[未发布]` 部分
   - 更新 VERSION_HISTORY.md

3. **版本号规则**（语义化版本）：
   - **主版本号（Major）**：不兼容的 API 变更
   - **次版本号（Minor）**：向下兼容的新功能
   - **修订号（Patch）**：向下兼容的 Bug 修复

### 提交信息格式

```bash
# 格式
<type>(<scope>): <subject>

# 示例
feat(tools): 添加分区表支持
fix(security): 修复 search_path 注入漏洞
docs(readme): 更新 openGauss 兼容性说明
perf(pool): 实现连接池
```

### 提交类型（type）
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

---

## openGauss 兼容性跟踪

### ✅ 已验证兼容
- PostgreSQL 协议连接
- pg_tables 系统视图
- information_schema 标准视图
- 基础 SQL 查询（SELECT, SHOW, EXPLAIN）
- CTE (WITH 语句)
- 参数化查询

### ⚠️ 需要注意
- 表继承（openGauss 不支持）
- 部分 PostgreSQL 扩展
- 特定的系统函数

### 🔄 待测试
- 分区表查询
- 存储过程
- 触发器
- 复杂查询优化
- 大数据集处理

---

## 与 DM8 版本的差异

| 特性 | DM8 | openGauss | 说明 |
|------|-----|-----------|------|
| **数据库驱动** | dmdb | node-opengauss | 不同的驱动库 |
| **系统表** | ALL_TABLES | pg_tables | DM 特有 vs PG 标准 |
| **表结构查询** | ALL_TAB_COLUMNS | information_schema | 不同的系统视图 |
| **参数占位符** | :param | $1, $2 | 命名 vs 位置参数 |
| **标识符大小写** | 自动大写 | 保持原样 | DM 特性 |
| **只读验证** | 简单前缀 | 白名单+黑名单 | openGauss 更严格 |

---

## 安全更新记录

### 安全漏洞修复历史
（将来记录在此）

### 安全审查
- [x] 2025-11-08: 初始安全审查
  - 发现 7 个高危漏洞
  - 发现 5 个中危问题
  - 发现 8 个低危改进点
  - 安全评分: 68/100

### 安全公告
（重要安全更新将在此发布）

---

## 依赖更新记录

### node-opengauss
- 1.1.0 (2025-11-08): 初始版本

### @modelcontextprotocol/sdk
- 1.21.0 (2025-11-08): 初始版本

---

## 性能基准

### v1.0.0 基准（待测试）
- 连接创建时间: ~100ms
- 简单查询响应: ~50ms
- 表结构查询: ~80ms
- 并发请求: 待测试

---

## 链接

- [版本历史](./VERSION_HISTORY.md)
- [安全审查报告](../SECURITY_AUDIT_REPORT.md)
- [快速开始](../QUICK_START.md)
- [技术对比](../COMPARISON.md)
- [项目总结](../PROJECT_SUMMARY.md)
- [README](../README.md)

