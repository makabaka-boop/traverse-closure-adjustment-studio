import type {
  AdjustedEdge,
  AdjustmentResult,
  AllocationItem,
  AxisAllocation,
  EdgeInput
} from './types';

/**
 * 欧几里得整除的下整商：floor(a / b)，要求 b > 0。
 *
 * bigint 的 `/` 向零截断，负数时会比下取整大 1，需要按余数修正。
 * 余数恒满足 0 <= r < b，这样“按余数大小瓜分剩余单位”对负闭合差同样成立。
 */
export function floorDiv(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error('floorDiv 的除数必须为正');
  const q = a / b;
  const r = a % b;
  return r < 0n ? q - 1n : q;
}

/** 把字符串编码为 UTF-8 字节（id 虽限定 ASCII，仍按规约使用 UTF-8 字节序）。 */
export function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/**
 * 按 id 的 UTF-8 字节序做字典序比较：
 * 逐字节比较，较短且为前缀者更小。返回 -1 / 0 / 1。
 */
export function compareUtf8(a: Uint8Array, b: Uint8Array): -1 | 0 | 1 {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

/**
 * 在单个坐标轴上执行按权最大余数分配。
 *
 * 设闭合差 T = Σ 分量，需要把修正总量 target = -T 分配给 n 条边：
 *   1) 每条边的份额为 weight_i * |T| / W（W = Σweight），
 *      先取欧几里得下整商 base_i，得非负余数 r_i；
 *   2) 剩余 R = |T| - Σbase_i 个单位（0 <= R < n），
 *      依次分给余数最大者；余数相同按 id 的 UTF-8 字节序，小的先得；
 *   3) 按 target 的符号整体取号。
 *
 * 严格保证 Σcorrection === -closure === target。
 */
export function allocateAxis(
  axis: 'x' | 'y',
  values: readonly bigint[],
  weights: readonly bigint[],
  ids: readonly string[]
): AxisAllocation {
  const n = values.length;
  if (weights.length !== n || ids.length !== n) {
    throw new Error('allocateAxis: 输入数组长度不一致');
  }

  const closure = values.reduce((acc, v) => acc + v, 0n);
  const target = -closure;
  const totalWeight = weights.reduce((acc, w) => acc + w, 0n);
  if (totalWeight <= 0n) throw new Error('权重之和必须为正');

  const magnitude = target < 0n ? -target : target;
  const idBytes = ids.map(utf8Bytes);

  const items: AllocationItem[] = values.map((_, i) => {
    const numerator = weights[i] * magnitude;
    const base = floorDiv(numerator, totalWeight);
    const remainder = numerator - base * totalWeight;
    return {
      index: i,
      id: ids[i],
      numerator,
      weight: weights[i],
      base,
      remainder,
      extra: false,
      correction: 0n
    };
  });

  const baseSum = items.reduce((acc, it) => acc + it.base, 0n);
  const remaining = magnitude - baseSum;
  // floor 除法的数学性质：0 <= remaining < n
  if (remaining < 0n || remaining >= BigInt(n)) {
    throw new Error('剩余单位数越界，分配前提不成立');
  }

  // 余数降序；余数相同按 id UTF-8 字节序升序。
  const order = items
    .map((it) => it.index)
    .sort((i, j) => {
      const ri = items[i].remainder;
      const rj = items[j].remainder;
      if (ri !== rj) return rj > ri ? 1 : -1;
      return compareUtf8(idBytes[i], idBytes[j]);
    });

  for (let k = 0; k < Number(remaining); k++) {
    items[order[k]].extra = true;
  }

  const sign = target < 0n ? -1n : 1n;
  let sumCorrections = 0n;
  for (const it of items) {
    it.correction = sign * (it.base + (it.extra ? 1n : 0n));
    sumCorrections += it.correction;
  }

  if (sumCorrections !== target) {
    throw new Error(
      `${axis} 轴修正量之和 ${sumCorrections} 不等于目标 ${target}，不变量被破坏`
    );
  }

  return {
    axis,
    closure,
    target,
    totalWeight,
    items,
    extraOrder: order.slice(0, Number(remaining)),
    sumCorrections
  };
}

function toSafeInt(v: bigint): number {
  if (
    v > BigInt(Number.MAX_SAFE_INTEGER) ||
    v < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new Error(`数值 ${v} 超出安全整数范围`);
  }
  return Number(v);
}

/**
 * 对一份已通过校验的边序列执行两轴独立平差。
 * 返回逐边修正量、平差后分量以及两轴的完整分配明细。
 */
export function adjustTraverse(edges: readonly EdgeInput[]): AdjustmentResult {
  const ids = edges.map((e) => e.id);
  const dx = edges.map((e) => BigInt(e.dx));
  const dy = edges.map((e) => BigInt(e.dy));
  const weights = edges.map((e) => BigInt(e.weight));

  const x = allocateAxis('x', dx, weights, ids);
  const y = allocateAxis('y', dy, weights, ids);

  const adjustedEdges: AdjustedEdge[] = edges.map((e, i) => {
    const cx = x.items[i].correction;
    const cy = y.items[i].correction;
    return {
      ...e,
      cx: toSafeInt(cx),
      cy: toSafeInt(cy),
      ax: toSafeInt(BigInt(e.dx) + cx),
      ay: toSafeInt(BigInt(e.dy) + cy)
    };
  });

  return { edgeCount: edges.length, x, y, edges: adjustedEdges };
}
