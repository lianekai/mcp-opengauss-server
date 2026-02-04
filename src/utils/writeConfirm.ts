export const WRITE_CONFIRM_TOKEN = '确认';
export const DANGEROUS_OPERATION_CONFIRM_TOKEN = '确认执行危险操作';

/**
 * 检测 SQL 操作类型
 */
export function detectOperationType(query: string): 'INSERT' | 'UPDATE' | 'DELETE' | 'UNKNOWN' {
  const trimmed = query.trim().toUpperCase();
  
  if (/^INSERT\s+/i.test(trimmed)) {
    return 'INSERT';
  }
  if (/^UPDATE\s+/i.test(trimmed)) {
    return 'UPDATE';
  }
  if (/^DELETE\s+/i.test(trimmed)) {
    return 'DELETE';
  }
  
  // 检查 CTE 中的操作
  if (/^WITH\s+.*?\s+AS\s+.*?INSERT\s/is.test(trimmed)) {
    return 'INSERT';
  }
  if (/^WITH\s+.*?\s+AS\s+.*?UPDATE\s/is.test(trimmed)) {
    return 'UPDATE';
  }
  if (/^WITH\s+.*?\s+AS\s+.*?DELETE\s/is.test(trimmed)) {
    return 'DELETE';
  }
  
  return 'UNKNOWN';
}

/**
 * 检查是否为危险操作（UPDATE 或 DELETE）
 */
export function isDangerousOperation(query: string): boolean {
  const operationType = detectOperationType(query);
  return operationType === 'UPDATE' || operationType === 'DELETE';
}

/**
 * 验证写入操作确认
 * - INSERT: 需要基本确认（"确认"）
 * - UPDATE/DELETE: 需要危险操作确认（"确认执行危险操作"）
 */
export function isWriteConfirmed(confirm: string | undefined, query: string): boolean {
  if (!confirm) {
    return false;
  }
  
  const trimmedConfirm = confirm.trim();
  const isDangerous = isDangerousOperation(query);
  
  if (isDangerous) {
    // UPDATE 和 DELETE 需要更严格的确认
    return trimmedConfirm === DANGEROUS_OPERATION_CONFIRM_TOKEN;
  } else {
    // INSERT 只需要基本确认
    return trimmedConfirm === WRITE_CONFIRM_TOKEN;
  }
}

/**
 * 获取操作类型描述
 */
export function getOperationTypeDescription(query: string): string {
  const operationType = detectOperationType(query);
  switch (operationType) {
    case 'INSERT':
      return 'INSERT（插入）';
    case 'UPDATE':
      return 'UPDATE（更新）';
    case 'DELETE':
      return 'DELETE（删除）';
    default:
      return '未知操作';
  }
}

/**
 * 获取所需的确认令牌
 */
export function getRequiredConfirmToken(query: string): string {
  const isDangerous = isDangerousOperation(query);
  return isDangerous ? DANGEROUS_OPERATION_CONFIRM_TOKEN : WRITE_CONFIRM_TOKEN;
}

