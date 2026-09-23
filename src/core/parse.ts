import type { EdgeInput } from './types';

/** 解析结果：成功携带边序列，失败携带面向测量员的中文错误说明。 */
export type ParseOutcome =
  | { ok: true; edges: EdgeInput[] }
  | { ok: false; error: string };

const MIN_EDGES = 3;
const MAX_EDGES = 200;
const MAX_COMPONENT = 1_000_000;
const ALLOWED_KEYS: ReadonlySet<string> = new Set(['id', 'dx', 'dy', 'weight']);

/** 判断值是否为“真正的整数”：JSON number、有限且无小数。布尔不算。 */
function isIntegerNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v);
}

/** id 必须为非空、纯 ASCII（字节 0x00–0x7F）字符串。 */
function isAsciiId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && isPureAscii(v);
}

// 规约只要求 ASCII：0x00–0x7F 全部接受（含控制字符），
// 余数并列排序时按 UTF-8 字节序，NUL 等字符天然排在前面。
function isPureAscii(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

/**
 * 解析并严格校验整份输入。
 *
 * 任何非法字段、非法 id、重复 id、边数越界或结构错误都会拒绝整份数据
 * （由调用方负责保留上一份有效图形），错误信息指出第一条问题所在位置。
 */
export function parseEdges(rawText: string): ParseOutcome {
  let doc: unknown;
  try {
    doc = JSON.parse(rawText);
  } catch (e) {
    return {
      ok: false,
      error: `JSON 语法错误，整份数据未被接收：${(e as Error).message}`
    };
  }

  let list: unknown;
  if (Array.isArray(doc)) {
    list = doc;
  } else if (doc !== null && typeof doc === 'object') {
    const keys = Object.keys(doc as Record<string, unknown>);
    const extra = keys.filter((k) => k !== 'edges');
    if (extra.length > 0) {
      return {
        ok: false,
        error: `顶层包含未允许的字段 ${JSON.stringify(extra[0])}，仅支持 { "edges": [...] } 或直接给数组。`
      };
    }
    list = (doc as { edges?: unknown }).edges;
    if (!Array.isArray(list)) {
      return { ok: false, error: '顶层 "edges" 必须是数组。' };
    }
  } else {
    return {
      ok: false,
      error: '数据必须是边数组，或形如 { "edges": [...] } 的对象。'
    };
  }

  const arr = list as unknown[];
  if (arr.length < MIN_EDGES || arr.length > MAX_EDGES) {
    return {
      ok: false,
      error: `边数必须在 ${MIN_EDGES} 至 ${MAX_EDGES} 条之间，当前为 ${arr.length} 条，整份数据未被接收。`
    };
  }

  const seen = new Map<string, number>();
  const edges: EdgeInput[] = [];

  for (let i = 0; i < arr.length; i++) {
    const where = `第 ${i + 1} 条边`;
    const item = arr[i];

    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: `${where}：必须是对象。整份数据未被接收。` };
    }
    const rec = item as Record<string, unknown>;
    for (const key of Object.keys(rec)) {
      if (!ALLOWED_KEYS.has(key)) {
        return {
          ok: false,
          error: `${where}：存在未允许的字段 ${JSON.stringify(key)}，整份数据未被接收。`
        };
      }
    }

    const { id, dx, dy, weight } = rec as Record<string, unknown>;

    if (!isAsciiId(id)) {
      return {
        ok: false,
        error: `${where}：id 必须是非空纯 ASCII 字符串。整份数据未被接收。`
      };
    }
    if (seen.has(id)) {
      return {
        ok: false,
        error: `重复 id ${JSON.stringify(id)}（首见于第 ${seen.get(id)! + 1} 条边），整份数据未被接收。`
      };
    }

    if (!isIntegerNumber(dx) || Math.abs(dx) > MAX_COMPONENT) {
      return {
        ok: false,
        error: `${where}（id=${JSON.stringify(id)}）：dx 必须是绝对值不超过 10^6 的整数。整份数据未被接收。`
      };
    }
    if (!isIntegerNumber(dy) || Math.abs(dy) > MAX_COMPONENT) {
      return {
        ok: false,
        error: `${where}（id=${JSON.stringify(id)}）：dy 必须是绝对值不超过 10^6 的整数。整份数据未被接收。`
      };
    }
    if (!isIntegerNumber(weight) || weight <= 0) {
      return {
        ok: false,
        error: `${where}（id=${JSON.stringify(id)}）：weight 必须是正整数。整份数据未被接收。`
      };
    }

    seen.set(id, i);
    edges.push({ id, dx, dy, weight });
  }

  return { ok: true, edges };
}
