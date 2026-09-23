import { useMemo, useRef, useState } from 'react';
import { adjustTraverse } from './core/adjust';
import { parseEdges } from './core/parse';
import { downloadText, resultToJson } from './core/resultJson';
import { SAMPLE_INPUT } from './core/sample';
import type { AdjustmentResult, EdgeInput } from './core/types';
import { TraverseCanvas } from './components/TraverseCanvas';
import { CorrectionTable } from './components/CorrectionTable';

interface Accepted {
  raw: string;
  edges: EdgeInput[];
  result: AdjustmentResult;
}

type Banner =
  | { kind: 'error' | 'success' | 'info'; text: string }
  | null;

function buildAccepted(raw: string): Accepted | { error: string } {
  const parsed = parseEdges(raw);
  if (!parsed.ok) return { error: parsed.error };
  const result = adjustTraverse(parsed.edges);
  return { raw, edges: parsed.edges, result };
}

/** 仅在支持“文件共享”时才走系统分享，否则退化为下载。 */
async function shareFile(file: File): Promise<'shared' | 'unavailable'> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (navigator.share) {
    const data: ShareData = { files: [file], title: file.name };
    if (!nav.canShare || nav.canShare(data)) {
      await navigator.share(data);
      return 'shared';
    }
  }
  return 'unavailable';
}

export function App() {
  const initial = useMemo<Accepted | null>(() => {
    const built = buildAccepted(SAMPLE_INPUT);
    return 'error' in built ? null : built;
  }, []);
  const [inputText, setInputText] = useState(SAMPLE_INPUT);
  const [accepted, setAccepted] = useState<Accepted | null>(initial);
  const [banner, setBanner] = useState<Banner>(
    initial
      ? {
          kind: 'success',
          text: `已载入示例并完成平差：${initial.result.edgeCount} 条边。`
        }
      : null
  );
  const canvasHostRef = useRef<HTMLDivElement>(null);

  const draft = useMemo(() => {
    if (inputText === accepted?.raw) return { status: 'same' as const };
    const parsed = parseEdges(inputText);
    if (parsed.ok) {
      return { status: 'valid-draft' as const, edges: parsed.edges };
    }
    return { status: 'invalid-draft' as const, error: parsed.error };
  }, [inputText, accepted]);

  const applyInput = () => {
    const built = buildAccepted(inputText);
    if ('error' in built) {
      // 拒绝整份数据：accepted 图形保持不变
      setBanner({ kind: 'error', text: built.error });
      return;
    }
    setAccepted(built);
    setBanner({
      kind: 'success',
      text: `已接收 ${built.result.edgeCount} 条边并完成平差。闭合差  x=${built.result.x.closure}，y=${built.result.y.closure}；修正后两轴整数和严格为 0。`
    });
  };

  const loadSample = () => {
    setInputText(SAMPLE_INPUT);
    const built = buildAccepted(SAMPLE_INPUT);
    if ('error' in built) {
      setBanner({ kind: 'error', text: built.error });
      return;
    }
    setAccepted(built);
    setBanner({ kind: 'info', text: '已恢复内置示例。' });
  };

  const downloadJson = () => {
    if (!accepted) return;
    const stamp = new Date().toISOString().replaceAll(':', '-').replace(/\..+$/, '');
    downloadText(
      `traverse-adjustment-${stamp}.json`,
      resultToJson(accepted.edges, accepted.result, new Date().toISOString()),
      'application/json'
    );
  };

  const getCanvasPng = (): Promise<File | null> => {
    const canvas = canvasHostRef.current?.querySelector('canvas');
    if (!canvas) return Promise.resolve(null);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(
          blob
            ? new File([blob], 'traverse-adjustment.png', { type: blob.type })
            : null
        );
      }, 'image/png');
    });
  };

  const shareResult = async () => {
    if (!accepted) return;
    const png = await getCanvasPng();
    if (!png) {
      setBanner({ kind: 'error', text: '画布尚未就绪，无法导出图片。' });
      return;
    }
    try {
      const outcome = await shareFile(png);
      if (outcome === 'shared') {
        setBanner({ kind: 'success', text: '已通过系统分享发出平差图（PNG）。' });
      } else {
        // 离线/桌面环境常见：退化为下载 PNG，并提示可另行下载 JSON
        const url = URL.createObjectURL(png);
        const a = document.createElement('a');
        a.href = url;
        a.download = png.name;
        a.click();
        URL.revokeObjectURL(url);
        setBanner({
          kind: 'info',
          text: '当前环境不支持系统文件分享，已改为下载 PNG；结构化结果请使用“下载 JSON”。'
        });
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return;
      setBanner({ kind: 'error', text: `分享失败：${(e as Error).message}` });
    }
  };

  const closure = accepted
    ? { x: Number(accepted.result.x.closure), y: Number(accepted.result.y.closure) }
    : null;

  return (
    <>
      <header className="app-header">
        <h1>
          闭合导线平差工作台
          <span className="badge adj">纯前端 · 离线 · 毫米整数</span>
        </h1>
        <p className="sub">
          东西 / 南北闭合差独立按权重做最大余数分配（欧几里得下整商 + 余数排序，
          余数相同按 id UTF-8 字节序），修正后两轴整数和严格归零。
        </p>
      </header>

      <div className="layout">
        <section className="panel" aria-label="数据输入">
          <h2>边数据（JSON 数组，或 {'{"edges": [...]}'}）</h2>
          <textarea
            id="edge-input"
            spellCheck={false}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            aria-label="边数据 JSON 输入"
          />
          <div className="button-row">
            <button className="primary" onClick={applyInput}>
              校验并平差
            </button>
            <button onClick={loadSample}>载入示例</button>
            <button onClick={downloadJson} disabled={!accepted}>
              下载 JSON
            </button>
            <button onClick={shareResult} disabled={!accepted}>
              分享 / 导出画布
            </button>
          </div>
          {banner && <div className={`banner ${banner.kind}`}>{banner.text}</div>}
          {draft.status === 'valid-draft' &&
            accepted &&
            inputText !== accepted.raw && (
              <div className="banner info">
                编辑区数据合法（{draft.edges.length} 条边）但尚未接收；
                当前图形仍是上一份有效结果，点击“校验并平差”才会替换。
              </div>
            )}
          {draft.status === 'invalid-draft' && (
            <div className="banner info">
              编辑区存在问题，上一份有效图形保留中：{draft.error}
            </div>
          )}
        </section>

        <div className="result-col">
          <section className="panel" aria-label="闭合差与折线图">
            <h2>原始 / 平差后折线</h2>
            {accepted && closure && (
              <div className="summary-grid">
                <div className="stat">
                  <span className="k">边数</span>
                  <span className="v">{accepted.result.edgeCount}</span>
                </div>
                <div className="stat">
                  <span className="k">东西闭合差 fx</span>
                  <span className="v">{closure.x}</span>
                </div>
                <div className="stat">
                  <span className="k">南北闭合差 fy</span>
                  <span className="v">{closure.y}</span>
                </div>
                <div className="stat">
                  <span className="k">平差后 Σdx / Σdy</span>
                  <span className="v">0 / 0</span>
                </div>
              </div>
            )}
            <div className="legend">
              <span>
                <span
                  className="swatch"
                  style={{ borderTopColor: 'var(--orig)' }}
                />
                原始折线（红，虚线为未闭合缺口）
              </span>
              <span>
                <span
                  className="swatch"
                  style={{ borderTopColor: 'var(--adj)' }}
                />
                平差后折线（绿，严格闭合）
              </span>
            </div>
            <div ref={canvasHostRef}>
              {accepted ? (
                <TraverseCanvas edges={accepted.result.edges} />
              ) : (
                <canvas
                  height={480}
                  role="img"
                  aria-label="暂无可绘制的有效图形"
                />
              )}
            </div>
          </section>

          <section className="panel" aria-label="逐边修正量">
            <h2>逐边修正量</h2>
            {accepted ? (
              <CorrectionTable result={accepted.result} />
            ) : (
              <p className="banner info">还没有有效的已接收图形。</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
