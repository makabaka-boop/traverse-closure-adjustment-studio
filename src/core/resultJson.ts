import type { AdjustmentResult, EdgeInput } from './types';

/**
 * 平差结果导出为可逐毫米复算的 JSON。
 *
 * bigint 量（权重、闭合差、整除明细）以十进制字符串输出，
 * 整数修正量与平差后分量以 JSON number 输出，便于直接复算核对。
 */
export function resultToJson(
  input: readonly EdgeInput[],
  result: AdjustmentResult,
  generatedAt: string
): string {
  const axes = (a: AdjustmentResult['x']) => ({
    closure: a.closure.toString(),
    target: a.target.toString(),
    totalWeight: a.totalWeight.toString(),
    extraOrder: a.extraOrder,
    items: a.items.map((it) => ({
      index: it.index,
      id: it.id,
      weight: it.weight.toString(),
      numerator: it.numerator.toString(),
      base: it.base.toString(),
      remainder: it.remainder.toString(),
      extra: it.extra,
      correction: it.correction.toString()
    }))
  });

  const payload = {
    generatedAt,
    edgeCount: result.edgeCount,
    closure: {
      x: Number(result.x.closure),
      y: Number(result.y.closure)
    },
    invariant: {
      sumCx: Number(result.x.sumCorrections),
      sumCy: Number(result.y.sumCorrections),
      adjustedSumX: result.edges.reduce((s, e) => s + e.ax, 0),
      adjustedSumY: result.edges.reduce((s, e) => s + e.ay, 0),
      note: '平差后两轴整数和严格为 0'
    },
    edges: result.edges.map((e, i) => ({
      index: i,
      id: e.id,
      weight: e.weight,
      original: { dx: input[i].dx, dy: input[i].dy },
      correction: { cx: e.cx, cy: e.cy },
      adjusted: { dx: e.ax, dy: e.ay }
    })),
    allocation: { x: axes(result.x), y: axes(result.y) }
  };

  return JSON.stringify(payload, null, 2);
}

/** 触发浏览器下载（纯前端，使用 Blob URL，不经过网络）。 */
export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
