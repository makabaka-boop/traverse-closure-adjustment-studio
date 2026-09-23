import { describe, expect, it } from 'vitest';
import {
  adjustTraverse,
  allocateAxis,
  compareUtf8,
  floorDiv,
  utf8Bytes
} from './adjust';
import { parseEdges } from './parse';
import type { EdgeInput } from './types';

function edges(
  rows: ReadonlyArray<readonly [string, number, number, number]>
): EdgeInput[] {
  return rows.map(([id, dx, dy, weight]) => ({ id, dx, dy, weight }));
}

describe('floorDiv 欧几里得下整商', () => {
  it('正数整除与 JS 截断一致', () => {
    expect(floorDiv(10n, 3n)).toBe(3n);
    expect(floorDiv(9n, 3n)).toBe(3n);
  });

  it('负数向下取整，余数恒非负', () => {
    expect(floorDiv(-10n, 3n)).toBe(-4n); // -10/3 = -3.33
    expect(floorDiv(-9n, 3n)).toBe(-3n);
    expect(floorDiv(-1n, 5n)).toBe(-1n);
    // r = a - floor(a/b)*b 必须落在 [0, b)
    const a = -13n;
    const b = 5n;
    const q = floorDiv(a, b);
    const r = a - q * b;
    expect(r >= 0n && r < b).toBe(true);
  });

  it('零与大整数', () => {
    expect(floorDiv(0n, 7n)).toBe(0n);
    const big = 1_000_000n * 200n * 1_000_000_000n;
    expect(floorDiv(big - 1n, big)).toBe(0n);
  });
});

describe('compareUtf8 字节序', () => {
  it('ASCII 即字典序', () => {
    expect(compareUtf8(utf8Bytes('A'), utf8Bytes('B'))).toBe(-1);
    expect(compareUtf8(utf8Bytes('E10'), utf8Bytes('E2'))).toBe(-1);
    expect(compareUtf8(utf8Bytes('ab'), utf8Bytes('ab'))).toBe(0);
  });

  it('前缀短串更小；数字 id 不按数值排序', () => {
    expect(compareUtf8(utf8Bytes('a'), utf8Bytes('aa'))).toBe(-1);
    // 字节序下 "10" < "2"，避免误用数值序导致的错误裁决
    expect(compareUtf8(utf8Bytes('10'), utf8Bytes('2'))).toBe(-1);
  });
});

describe('负闭合差', () => {
  it('等权且可整除：负目标由 floor 与余数自然处理，总和严格为零', () => {
    // x 和 = -6，需要 +6；等权 4 份 → 每份 +1.5 → base 各 1，余数相同
    const input = edges([
      ['a', -5, 0, 1],
      ['b', 3, 0, 1],
      ['c', -4, 0, 1],
      ['d', 0, 0, 1]
    ]);
    const r = adjustTraverse(input);
    expect(r.x.closure).toBe(-6n);
    expect(r.x.target).toBe(6n);
    // 余数全为 2（1*6 mod 4），并列按 id 字节序：a、b 先得
    expect(r.x.extraOrder).toEqual([0, 1]);
    expect(r.x.items.map((i) => i.correction)).toEqual([2n, 2n, 1n, 1n]);
    expect(r.x.sumCorrections).toBe(6n);
    expect(
      r.edges.reduce((s, e) => s + BigInt(e.ax), 0n)
    ).toBe(0n);
  });

  it('不等权负闭合：份额按权重，取号正确', () => {
    // x 和 = -3，权重 1,2,3,4（W=10），份额 0.3 / 0.6 / 0.9 / 1.2
    const input = edges([
      ['E1', 1000, 0, 1],
      ['E2', 0, 0, 2],
      ['E3', -1000, 0, 3],
      ['E4', -3, 0, 4]
    ]);
    const r = adjustTraverse(input);
    expect(r.x.closure).toBe(-3n);
    // numerator 3,6,9,12 / W=10：base 0,0,0,1；余数 3,6,9,2；
    // baseSum=1，R=2，余数最大者 E3(9)、E2(6) 得单位
    expect(r.x.extraOrder).toEqual([2, 1]);
    expect(r.x.items.map((i) => i.correction)).toEqual([0n, 1n, 1n, 1n]);
    // 平差后整数和严格为零
    expect(r.edges.map((e) => e.ax)).toEqual([1000, 1, -999, -2]);
    expect(r.edges.reduce((s, e) => s + e.ax, 0)).toBe(0);
  });

  it('正闭合差时修正量整体为负', () => {
    // x 和 = 4，需要 -4；权重 1,2,3,4
    const input = edges([
      ['E1', 0, 2, 1],
      ['E2', 0, 1504, 2],
      ['E3', 0, 0, 3],
      ['E4', 4, -1502, 4]
    ]);
    const r = adjustTraverse(input);
    expect(r.x.closure).toBe(4n);
    expect(r.x.target).toBe(-4n);
    // 余数 4,8,12,16 → 4,8,2,6(mod10)；base 0,0,1,1；R=2 给 E3 之外余数最大者：
    // base 和 = 2，R=2，余数排序 E2(8)、E4(6)、E1(4)、E3(2)
    expect(r.x.extraOrder).toEqual([1, 3]);
    expect(r.x.items.map((i) => i.correction)).toEqual([0n, -1n, -1n, -2n]);
    expect(r.x.sumCorrections).toBe(-4n);
    expect(r.edges.reduce((s, e) => s + e.ax, 0)).toBe(0);
  });
});

describe('余数相同按 id UTF-8 字节序', () => {
  it('并列时字节序最小者先得剩余单位', () => {
    // x 和 = 3 → target -3；权重全部 2，份额各 1.5，余数全相等
    const input = edges([
      ['zeta', 1, 0, 2],
      ['alpha', 1, 0, 2],
      ['Beta', 1, 0, 2],
      ['mid', 0, 0, 2]
    ]);
    const r = adjustTraverse(input);
    // 大写 B(0x42) < 小写 a(0x61) < m < z
    expect(r.x.extraOrder).toEqual([2, 1, 3]);
    // numerator 6/8 → base 全 0，三个单位分给 Beta、alpha、mid
    expect(r.x.items.map((i) => i.correction)).toEqual([0n, -1n, -1n, -1n]);
  });

  it('数字形态 id 按字节而非数值裁决', () => {
    const input = edges([
      ['10', 1, 0, 1],
      ['2', 1, 0, 1],
      ['9', 1, 0, 1],
      ['1', 0, 0, 1]
    ]);
    const r = adjustTraverse(input);
    // 等权、同余数；字节序 "1" < "10" < "2" < "9"
    expect(r.x.extraOrder).toEqual([3, 0, 1]);
  });
});

describe('两轴独立、总和不变量', () => {
  it('x、y 闭合差不同时各自独立分配，修正后两轴均严格归零', () => {
    const input = edges([
      ['p1', 12, -7, 5],
      ['p2', -3, 20, 1],
      ['p3', 8, -4, 3],
      ['p4', -20, 9, 2],
      ['p5', 6, -15, 4]
    ]);
    const r = adjustTraverse(input);
    expect(r.x.closure).toBe(3n);
    expect(r.y.closure).toBe(3n);
    expect(r.x.sumCorrections).toBe(-3n);
    expect(r.y.sumCorrections).toBe(-3n);
    let sumAx = 0;
    let sumAy = 0;
    for (const e of r.edges) {
      expect(e.ax).toBe(e.dx + e.cx);
      expect(e.ay).toBe(e.dy + e.cy);
      sumAx += e.ax;
      sumAy += e.ay;
    }
    expect(sumAx).toBe(0);
    expect(sumAy).toBe(0);
  });

  it('任意权重组合下 Σ(weight*|T|/W) 的 floor + 余数瓜分恒等于目标', () => {
    // 随机风格的性质测试：T 从 -50 到 50，多种权重
    const wsets = [
      [1, 1, 1],
      [1, 2, 3],
      [7, 11, 13],
      [1, 100, 1],
      [3, 1, 4, 1, 5, 9, 2, 6]
    ];
    for (const ws of wsets) {
      for (let t = -50; t <= 50; t++) {
        // 构造分量序列使其和恰好为 t：前 n-1 个给定，最后一个补差
        const vals: bigint[] = [];
        let s = 0n;
        for (let i = 0; i < ws.length - 1; i++) {
          const v = BigInt(((i * 37 + (t + 50) * 7) % 23) - 11);
          vals.push(v);
          s += v;
        }
        vals.push(BigInt(t) - s);
        const ids = ws.map((_, i) => `id${i}`);
        const a = allocateAxis(
          'x',
          vals,
          ws.map((w) => BigInt(w)),
          ids
        );
        expect(a.sumCorrections).toBe(-BigInt(t));
        expect(a.closure).toBe(BigInt(t));
      }
    }
  });

  it('零闭合差时所有修正量为 0，且不产生任何额外单位', () => {
    const input = edges([
      ['a', 100, 200, 1],
      ['b', -50, -100, 9],
      ['c', -50, -100, 4]
    ]);
    const r = adjustTraverse(input);
    expect(r.x.closure).toBe(0n);
    expect(r.y.closure).toBe(0n);
    expect(r.x.extraOrder).toEqual([]);
    expect(r.y.extraOrder).toEqual([]);
    expect(r.edges.every((e) => e.cx === 0 && e.cy === 0)).toBe(true);
  });

  it('极端输入：200 条边、10^6 分量与大权重仍为精确整数', () => {
    const rows: [string, number, number, number][] = [];
    let sumX = 0;
    for (let i = 0; i < 200; i++) {
      const dx = i === 199 ? -(sumX - 7) : i % 2 === 0 ? 12345 : -6789;
      if (i < 199) sumX += dx;
      rows.push([`S${String(i).padStart(3, '0')}`, dx, 0, 1 + (i % 1000)]);
    }
    const r = adjustTraverse(edges(rows));
    expect(r.x.closure).toBe(7n);
    expect(r.edges.reduce((s, e) => s + e.ax, 0)).toBe(0);
  });
});

describe('parseEdges 严格校验', () => {
  const valid = JSON.stringify([
    { id: 'a', dx: 1, dy: 2, weight: 1 },
    { id: 'b', dx: 3, dy: -4, weight: 2 },
    { id: 'c', dx: -5, dy: 6, weight: 3 }
  ]);

  it('接受数组与 {edges:[]} 两种形态', () => {
    expect(parseEdges(valid).ok).toBe(true);
    expect(parseEdges(`{"edges":${valid}}`).ok).toBe(true);
  });

  it('拒绝重复 id 并整份拒绝', () => {
    const dup = [
      { id: 'a', dx: 1, dy: 0, weight: 1 },
      { id: 'a', dx: 2, dy: 0, weight: 1 },
      { id: 'c', dx: 3, dy: 0, weight: 1 }
    ];
    const o = parseEdges(JSON.stringify(dup));
    expect(o.ok).toBe(false);
    if (!o.ok) expect(o.error).toContain('重复 id');
  });

  it('拒绝非 ASCII id、空 id', () => {
    const bad = (id: unknown) =>
      JSON.stringify([
        { id, dx: 1, dy: 0, weight: 1 },
        { id: 'b', dx: 1, dy: 0, weight: 1 },
        { id: 'c', dx: 1, dy: 0, weight: 1 }
      ]);
    expect(parseEdges(bad('边1')).ok).toBe(false);
    expect(parseEdges(bad('')).ok).toBe(false);
    expect(parseEdges(bad(42)).ok).toBe(false);
  });

  it('拒绝越界分量、非正权重、小数与布尔', () => {
    const mk = (patch: Record<string, unknown>) =>
      JSON.stringify([
        { id: 'a', dx: 1, dy: 0, weight: 1, ...patch },
        { id: 'b', dx: 1, dy: 0, weight: 1 },
        { id: 'c', dx: 1, dy: 0, weight: 1 }
      ]);
    expect(parseEdges(mk({ dx: 1_000_001 })).ok).toBe(false);
    expect(parseEdges(mk({ dy: -1_000_001 })).ok).toBe(false);
    expect(parseEdges(mk({ weight: 0 })).ok).toBe(false);
    expect(parseEdges(mk({ weight: -2 })).ok).toBe(false);
    expect(parseEdges(mk({ dx: 1.5 })).ok).toBe(false);
    expect(parseEdges(mk({ dx: '1' })).ok).toBe(false);
    expect(parseEdges(mk({ weight: true })).ok).toBe(false);
    expect(parseEdges(mk({ extra: 1 })).ok).toBe(false);
  });

  it('拒绝边数不足或超过上限、结构错误', () => {
    expect(parseEdges('[]').ok).toBe(false);
    expect(parseEdges('{}').ok).toBe(false);
    expect(parseEdges('null').ok).toBe(false);
    expect(parseEdges('not json').ok).toBe(false);
    const two = [
      { id: 'a', dx: 1, dy: 0, weight: 1 },
      { id: 'b', dx: 1, dy: 0, weight: 1 }
    ];
    expect(parseEdges(JSON.stringify(two)).ok).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => ({
      id: `e${i}`,
      dx: 0,
      dy: 0,
      weight: 1
    }));
    expect(parseEdges(JSON.stringify(many)).ok).toBe(false);
  });
});
