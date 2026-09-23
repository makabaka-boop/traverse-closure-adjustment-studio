/**
 * 闭合导线平差核心类型定义。
 *
 * 输入边长的坐标分量与权重均为整数；为避免任何浮点/舍入歧义，
 * 分配过程中的整除、余数与闭合差全部使用 bigint 精确计算。
 */

/** 一条观测边（用户输入形态，全部为可 JSON 序列化的整数）。 */
export interface EdgeInput {
  /** 唯一非空 ASCII id。 */
  id: string;
  /** 东西分量（东为正），整数，|dx| <= 10^6。 */
  dx: number;
  /** 南北分量（北为正），整数，|dy| <= 10^6。 */
  dy: number;
  /** 观测权重，正整数。 */
  weight: number;
}

/** 单个轴上某条边的分配明细。 */
export interface AllocationItem {
  /** 对应原始边在顺序数组中的下标。 */
  index: number;
  id: string;
  /** 该边在本轴承担的总修正目标份额（比例分子）：weight * |T|。 */
  numerator: bigint;
  weight: bigint;
  /** 欧几里得下整商 floor((weight*|T|) / W)。 */
  base: bigint;
  /** 欧几里得余数 r，0 <= r < W。 */
  remainder: bigint;
  /** 是否再分到一个剩余单位。 */
  extra: boolean;
  /** 本轴最终修正量（已按闭合差符号取号）。 */
  correction: bigint;
}

/** 单个轴（东西/南北）的分配结果。 */
export interface AxisAllocation {
  axis: 'x' | 'y';
  /** 闭合差 T = Σ 分量。 */
  closure: bigint;
  /** 修正总量目标（恒为 -closure）。 */
  target: bigint;
  totalWeight: bigint;
  /** 仍按原始边顺序排列的逐边明细。 */
  items: AllocationItem[];
  /** 被追加单位的边，按分配先后（余数降序、id UTF-8 升序）。 */
  extraOrder: number[];
  /** 校验不变量：Σ correction，必须严格等于 target。 */
  sumCorrections: bigint;
}

/** 携带修正量与平差后分量的边。数值字段全部为整数 number。 */
export interface AdjustedEdge extends EdgeInput {
  /** x 方向修正量（整数毫米）。 */
  cx: number;
  cy: number;
  /** 平差后分量 ax = dx + cx。 */
  ax: number;
  ay: number;
}

/** 一次完整平差的结果。 */
export interface AdjustmentResult {
  edgeCount: number;
  x: AxisAllocation;
  y: AxisAllocation;
  edges: AdjustedEdge[];
}
