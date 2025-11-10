# 🔒 mcp-opengauss-server 安全修复指南

**修复版本**: 1.1.0  
**创建日期**: 2025-11-10  
**预计修复时间**: 2-3 周  
**安全评分提升**: 68/100 → 90/100

---

## 📋 目录

1. [修复概览](#修复概览)
2. [立即修复（高危）](#立即修复高危)
3. [短期修复（中危）](#短期修复中危)
4. [完整代码实现](#完整代码实现)
5. [测试验证](#测试验证)
6. [部署指南](#部署指南)

---

## 修复概览

### 修复优先级

| 优先级 | 漏洞 | 状态 | 预计时间 |
|--------|------|------|----------|
| 🔴 P0 | SQL 注入 (db.ts) | 待修复 | 2小时 |
| 🔴 P0 | 只读验证不足 | 待修复 | 3小时 |
| 🔴 P0 | 输入长度限制 | 待修复 | 1小时 |
| 🟠 P1 | 连接池实现 | 待修复 | 4小时 |
| 🟠 P1 | 查询超时 | 待修复 | 2小时 |
| 🟠 P1 | 速率限制 | 待修复 | 3小时 |
| 🟡 P2 | 错误处理改进 | 待修复 | 2小时 |
| 🟡 P2 | 日志系统 | 待修复 | 4小时 |

### 修复文件清单

```
mcp-opengauss-server/
├── src/
│   ├── utils/
│   │   ├── db.ts              ✏️ 需要重写（连接池）
│   │   ├── validation.ts      ✏️ 需要增强
│   │   ├── rateLimit.ts       ➕ 新增
│   │   ├── logger.ts          ➕ 新增
│   │   └── security.ts        ➕ 新增
│   ├── config.ts              ✏️ 需要增强
│   └── tools/
│       ├── executeQuery.ts    ✏️ 需要修改
│       ├── listTables.ts      ✏️ 需要修改
│       └── describeTable.ts   ✏️ 需要修改
├── tests/                     ➕ 添加测试
│   ├── validation.test.ts
│   ├── db.test.ts
│   └── security.test.ts
└── package.json               ✏️ 添加新依赖
```

---

## 立即修复（高危）

### 🔴 修复 #1: SQL 注入漏洞

**文件**: `src/utils/db.ts`  
**严重程度**: CRITICAL (8.8/10)

#### 修复前的代码（有漏洞）

```typescript
// ❌ 危险：直接字符串拼接
if (config.schema && config.schema !== 'public') {
  await client.query(`SET search_path TO ${config.schema}, public`);
}
```

#### 修复后的代码（安全）

```typescript
// ✅ 安全：先验证后使用
if (config.schema && config.schema !== 'public') {
  const validatedSchema = normalizeIdentifier(config.schema);
  // 使用参数化查询或验证后的安全标识符
  await client.query(`SET search_path TO ${validatedSchema}, public`);
}
```

**完整修复代码在下方"完整代码实现"章节**

---

### 🔴 修复 #2: 增强只读查询验证

**文件**: `src/utils/validation.ts`  
**严重程度**: HIGH (7.2/10)

#### 新增检查项

1. ✅ 多语句检测（防止 `SELECT 1; DROP TABLE`）
2. ✅ 危险函数过滤（`pg_read_file`, `COPY`, `LOAD` 等）
3. ✅ 子查询写操作检测
4. ✅ 文件操作检测（`INTO OUTFILE`, `INTO DUMPFILE`）

---

### 🔴 修复 #3: 添加输入长度限制

**文件**: `src/utils/validation.ts`  
**严重程度**: MEDIUM (5.0/10)

```typescript
const MAX_QUERY_LENGTH = 10000;       // 10KB
const MAX_IDENTIFIER_LENGTH = 128;    // 128字符
const MAX_TABLE_NAME_LENGTH = 64;     // 64字符
```

---

## 短期修复（中危）

### 🟠 修复 #4: 实现连接池

**文件**: `src/utils/db.ts`  
**严重程度**: HIGH (7.5/10)

#### 修复要点

- 使用 `Pool` 替代 `Client`
- 配置连接池参数（max, min, idle timeout）
- 添加错误处理和监控
- 实现优雅关闭

---

### 🟠 修复 #5: 添加查询超时

**默认超时**: 30秒  
**可配置**: 通过环境变量 `QUERY_TIMEOUT`

---

### 🟠 修复 #6: 实现速率限制

**新文件**: `src/utils/rateLimit.ts`  
**限制**: 每分钟 100 请求（可配置）

---

## 完整代码实现

详细修复代码请查看以下文件：

1. `src/utils/db.fixed.ts` - 连接池实现
2. `src/utils/validation.fixed.ts` - 增强验证
3. `src/utils/rateLimit.ts` - 速率限制
4. `src/utils/logger.ts` - 日志系统
5. `src/utils/security.ts` - 安全工具集

---

## 测试验证

### 安全测试用例

```typescript
// tests/security.test.ts
describe('SQL Injection Prevention', () => {
  it('should block malicious schema names', () => {
    expect(() => {
      normalizeIdentifier("public; DROP TABLE users; --")
    }).toThrow(ValidationError);
  });

  it('should block multi-statement queries', () => {
    expect(() => {
      assertReadOnlyQuery("SELECT 1; DROP TABLE users;")
    }).toThrow(ValidationError);
  });

  it('should block dangerous functions', () => {
    expect(() => {
      assertReadOnlyQuery("SELECT pg_read_file('/etc/passwd')")
    }).toThrow(ValidationError);
  });
});
```

---

## 部署指南

### 1. 安装新依赖

```bash
npm install limiter pino pg-format
npm install --save-dev @types/pg-format
```

### 2. 更新环境变量

```bash
# 在 .env 中添加
QUERY_TIMEOUT=30000          # 查询超时（毫秒）
RATE_LIMIT_MAX=100           # 速率限制（每分钟）
CONNECTION_POOL_MAX=20       # 最大连接数
CONNECTION_POOL_MIN=2        # 最小连接数
LOG_LEVEL=info               # 日志级别
NODE_ENV=production          # 环境
```

### 3. 逐步部署

```bash
# 步骤 1: 备份当前代码
cp -r src src.backup

# 步骤 2: 应用修复
cp src/utils/db.fixed.ts src/utils/db.ts
cp src/utils/validation.fixed.ts src/utils/validation.ts

# 步骤 3: 重新构建
npm run build

# 步骤 4: 运行测试
npm test

# 步骤 5: 验证安全性
npm run security-audit
```

---

## 验收标准

修复完成后应满足：

- [ ] 所有高危漏洞已修复
- [ ] 安全测试 100% 通过
- [ ] OWASP Top 10 合规性 ≥ 80%
- [ ] 性能测试通过（连接池、超时）
- [ ] 日志系统正常运行
- [ ] 速率限制生效
- [ ] 文档已更新

---

## 下一步

1. 查看并应用 `src/utils/db.fixed.ts`
2. 查看并应用 `src/utils/validation.fixed.ts`
3. 创建新文件 `src/utils/rateLimit.ts`
4. 创建新文件 `src/utils/logger.ts`
5. 更新 `package.json` 添加依赖
6. 编写并运行安全测试
7. 更新部署文档

**注意**: 请按照优先级顺序修复，不要跳过高危漏洞！

