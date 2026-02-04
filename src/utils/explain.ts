import { ValidationError } from './validation.fixed.js';

export type ExplainFormat = 'json' | 'text';

export type ExplainOptions = {
  analyze?: boolean;
  buffers?: boolean;
  verbose?: boolean;
  format?: ExplainFormat;
};

function normalizeFormat(format: ExplainOptions['format']): ExplainFormat {
  return format === 'text' ? 'text' : 'json';
}

export function buildExplainSql(query: string, options: ExplainOptions = {}): { sql: string; format: ExplainFormat } {
  if (!query || query.trim().length === 0) {
    throw new ValidationError('查询不能为空', 'EMPTY_QUERY');
  }

  const format = normalizeFormat(options.format);
  const clauses: string[] = [];

  if (options.analyze) {
    clauses.push('ANALYZE');
  }
  if (options.buffers) {
    clauses.push('BUFFERS');
  }
  if (options.verbose) {
    clauses.push('VERBOSE');
  }

  clauses.push(`FORMAT ${format.toUpperCase()}`);

  const clause = clauses.length > 0 ? ` (${clauses.join(', ')})` : '';
  return { sql: `EXPLAIN${clause} ${query}`, format };
}

export function formatExplainResultText(rows: Array<Record<string, unknown>>): string {
  if (!rows || rows.length === 0) {
    return '无执行计划结果';
  }

  const firstRow = rows[0] ?? {};
  const possibleKeys = ['QUERY PLAN', 'query_plan', 'Plan', 'plan'];
  const key = possibleKeys.find((k) => Object.prototype.hasOwnProperty.call(firstRow, k));

  if (key) {
    const value = rows.map((r) => String((r as any)[key] ?? '')).filter(Boolean);
    if (value.length > 0) {
      return value.join('\n');
    }
  }

  try {
    return JSON.stringify(rows, null, 2);
  } catch {
    return String(rows);
  }
}

export function extractExplainTimingsFromJsonPlan(plan: unknown): {
  planningTimeMs?: number;
  executionTimeMs?: number;
} {
  if (!plan || typeof plan !== 'object') {
    return {};
  }

  const top = Array.isArray(plan) ? plan[0] : plan;
  if (!top || typeof top !== 'object') {
    return {};
  }

  const planningTimeMs = (top as any)['Planning Time'];
  const executionTimeMs = (top as any)['Execution Time'];

  return {
    planningTimeMs: typeof planningTimeMs === 'number' ? planningTimeMs : undefined,
    executionTimeMs: typeof executionTimeMs === 'number' ? executionTimeMs : undefined,
  };
}

