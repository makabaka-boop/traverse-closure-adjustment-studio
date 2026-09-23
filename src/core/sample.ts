/**
 * 内置示例：4 条边的闭合导线（毫米整数）。
 * 东、北、西、南闭合，故意留有 -3 / +4 的闭合差，
 * 且各边权重不等，便于演示按权最大余数分配与并列裁决。
 */
export const SAMPLE_INPUT = JSON.stringify(
  {
    edges: [
      { id: 'E1', dx: 1003, dy: 2, weight: 1 },
      { id: 'E2', dx: -2, dy: 1504, weight: 2 },
      { id: 'E3', dx: -1001, dy: -1, weight: 3 },
      { id: 'E4', dx: -3, dy: -1501, weight: 4 }
    ]
  },
  null,
  2
);
