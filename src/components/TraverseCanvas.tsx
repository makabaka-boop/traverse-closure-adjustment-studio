import { useEffect, useRef } from 'react';
import type { AdjustedEdge } from '../core/types';

interface Props {
  edges: readonly AdjustedEdge[];
}

interface Pt {
  x: number;
  y: number;
}

/** 累积折线顶点，两条线都从原点 (0,0) 出发。 */
function cumulative(edges: readonly AdjustedEdge[]): {
  original: Pt[];
  adjusted: Pt[];
} {
  const original: Pt[] = [{ x: 0, y: 0 }];
  const adjusted: Pt[] = [{ x: 0, y: 0 }];
  let ox = 0;
  let oy = 0;
  let ax = 0;
  let ay = 0;
  for (const e of edges) {
    ox += e.dx;
    oy += e.dy;
    ax += e.ax;
    ay += e.ay;
    original.push({ x: ox, y: oy });
    adjusted.push({ x: ax, y: ay });
  }
  return { original, adjusted };
}

/** “好看的”网格步长：在 1/2/5 × 10^k 中挑选。 */
function niceStep(rough: number): number {
  if (rough <= 0 || !isFinite(rough)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  let m: number;
  if (n <= 1) m = 1;
  else if (n <= 2) m = 2;
  else if (n <= 5) m = 5;
  else m = 10;
  return m * pow;
}

/**
 * 叠画原始（红）与平差后（绿）折线：
 * - 测量坐标北向上，因此画布 y 轴取反；
 * - 起点用方形标记；原始终点即未闭合点，红虚线段直观显示闭合差；
 * - 平差后终点严格回到起点。
 */
export function TraverseCanvas({ edges }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const cssWidth = canvas.clientWidth || 800;
      const cssHeight = canvas.clientHeight || 480;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      const { original, adjusted } = cumulative(edges);
      const all = [...original, ...adjusted];
      let minX = Math.min(...all.map((p) => p.x));
      let maxX = Math.max(...all.map((p) => p.x));
      let minY = Math.min(...all.map((p) => p.y));
      let maxY = Math.max(...all.map((p) => p.y));
      // 退化情形（直线/单点）留出余量，避免除零
      if (minX === maxX) {
        minX -= 1;
        maxX += 1;
      }
      if (minY === maxY) {
        minY -= 1;
        maxY += 1;
      }

      const padL = 56;
      const padR = 24;
      const padT = 24;
      const padB = 40;
      const plotW = Math.max(10, cssWidth - padL - padR);
      const plotH = Math.max(10, cssHeight - padT - padB);
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const scale = Math.min(plotW / spanX, plotH / spanY);

      // 居中放置
      const usedW = spanX * scale;
      const usedH = spanY * scale;
      const offX = padL + (plotW - usedW) / 2;
      const offY = padT + (plotH - usedH) / 2;
      const toPx = (p: Pt): Pt => ({
        x: offX + (p.x - minX) * scale,
        // 北向上：翻转 y
        y: offY + (maxY - p.y) * scale
      });

      // 网格（约 8~10 格）
      const stepX = niceStep(spanX / 8);
      const stepY = niceStep(spanY / 8);
      ctx.lineWidth = 1;
      ctx.font = '11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = '#eef1f4';
      ctx.fillStyle = '#8a97a3';

      const startGridX = Math.ceil(minX / stepX) * stepX;
      for (let gx = startGridX; gx <= maxX; gx += stepX) {
        const px = toPx({ x: gx, y: 0 }).x;
        ctx.beginPath();
        ctx.moveTo(px, padT);
        ctx.lineTo(px, padT + plotH);
        ctx.stroke();
        ctx.fillText(String(Math.round(gx)), px, padT + plotH + 6);
      }
      const startGridY = Math.ceil(minY / stepY) * stepY;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let gy = startGridY; gy <= maxY; gy += stepY) {
        const py = toPx({ x: 0, y: gy }).y;
        ctx.beginPath();
        ctx.moveTo(padL, py);
        ctx.lineTo(padL + plotW, py);
        ctx.stroke();
        ctx.fillText(String(Math.round(gy)), padL - 8, py);
      }

      // 坐标边框
      ctx.strokeStyle = '#cdd6de';
      ctx.strokeRect(padL, padT, plotW, plotH);

      const polyline = (pts: Pt[], color: string, width: number, dash: number[]) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.setLineDash(dash);
        ctx.beginPath();
        pts.forEach((p, i) => {
          const q = toPx(p);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
        ctx.restore();
      };

      // 原始：红实线 + 未闭合缺口用更显眼的红色虚线连接
      polyline(original, '#d64545', 2.5, []);
      const oStart = toPx(original[0]);
      const oEnd = toPx(original[original.length - 1]);
      ctx.save();
      ctx.strokeStyle = '#d64545';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(oEnd.x, oEnd.y);
      ctx.lineTo(oStart.x, oStart.y);
      ctx.stroke();
      ctx.restore();

      // 平差后：绿色实线（闭合）
      polyline(adjusted, '#1f7a4d', 2, []);

      // 顶点
      ctx.setLineDash([]);
      original.forEach((p, i) => {
        if (i === 0 || i === original.length - 1) return;
        const q = toPx(p);
        ctx.fillStyle = '#d64545';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
      adjusted.forEach((p, i) => {
        if (i === 0 || i === adjusted.length - 1) return;
        const q = toPx(p);
        ctx.fillStyle = '#1f7a4d';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 起点：黑色方块；原始终点：红圈；平差终点：绿圈（与起点重合）
      ctx.fillStyle = '#1f2933';
      ctx.fillRect(oStart.x - 4, oStart.y - 4, 8, 8);
      ctx.strokeStyle = '#d64545';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(oEnd.x, oEnd.y, 5, 0, Math.PI * 2);
      ctx.stroke();
      const aEnd = toPx(adjusted[adjusted.length - 1]);
      ctx.strokeStyle = '#1f7a4d';
      ctx.beginPath();
      ctx.arc(aEnd.x, aEnd.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      // 标签
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#1f2933';
      ctx.fillText('起点 / 终点', oStart.x + 8, oStart.y - 6);
      ctx.fillStyle = '#d64545';
      ctx.textAlign = oEnd.x > cssWidth - 90 ? 'right' : 'left';
      ctx.fillText('未闭合点', oEnd.x + (oEnd.x > cssWidth - 90 ? -8 : 8), oEnd.y + 14);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [edges]);

  return (
    <div className="canvas-wrap">
      <canvas ref={canvasRef} role="img" aria-label="原始与平差后折线叠画图" />
    </div>
  );
}
