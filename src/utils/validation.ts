export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * 验证 SQL 查询是否为只读操作
 * 仅允许: SELECT, SHOW, DESCRIBE, EXPLAIN, WITH (CTE)
 */
export function assertReadOnlyQuery(query: string): void {
  const trimmed = query.trim().toUpperCase();
  
  // 允许的只读操作关键字
  const allowedPatterns = [
    /^SELECT\s/i,
    /^WITH\s.*\sAS\s.*SELECT\s/is, // CTE (Common Table Expression)
    /^SHOW\s/i,
    /^DESCRIBE\s/i,
    /^DESC\s/i,
    /^EXPLAIN\s/i,
  ];

  const isReadOnly = allowedPatterns.some((pattern) => pattern.test(trimmed));

  if (!isReadOnly) {
    throw new ValidationError(
      '仅允许只读查询 (SELECT, SHOW, DESCRIBE, EXPLAIN, WITH)'
    );
  }

  // 检查危险关键字
  const dangerousKeywords = [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bDROP\b/i,
    /\bCREATE\b/i,
    /\bALTER\b/i,
    /\bTRUNCATE\b/i,
    /\bGRANT\b/i,
    /\bREVOKE\b/i,
  ];

  for (const keyword of dangerousKeywords) {
    if (keyword.test(query)) {
      throw new ValidationError(
        `查询中包含不允许的操作: ${keyword.source.replace(/\\b/g, '')}`
      );
    }
  }
}

/**
 * 规范化标识符（schema、表名等）
 * 移除危险字符，防止 SQL 注入
 */
export function normalizeIdentifier(identifier: string | undefined): string {
  if (!identifier) {
    throw new ValidationError('标识符不能为空');
  }

  const normalized = identifier.trim();
  
  // 检查是否包含危险字符
  if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
    throw new ValidationError(
      `标识符包含非法字符: ${identifier}. 仅允许字母、数字和下划线`
    );
  }

  return normalized;
}

/**
 * 验证表名格式
 */
export function validateTableName(tableName: string): void {
  if (!tableName || tableName.trim().length === 0) {
    throw new ValidationError('表名不能为空');
  }

  // 允许 schema.table 格式
  const parts = tableName.split('.');
  if (parts.length > 2) {
    throw new ValidationError('表名格式错误，最多允许一个点号 (schema.table)');
  }

  parts.forEach((part) => {
    if (!/^[a-zA-Z0-9_]+$/.test(part.trim())) {
      throw new ValidationError(
        `表名包含非法字符: ${tableName}. 仅允许字母、数字、下划线和点号`
      );
    }
  });
}



