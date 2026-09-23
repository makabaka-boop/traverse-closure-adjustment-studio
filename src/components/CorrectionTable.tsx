import type { AdjustmentResult } from '../core/types';

interface Props {
  result: AdjustmentResult;
}

function signed(v: number): string {
  return v > 0 ? `+${v}` : String(v);
}

function cls(v: number): string {
  return v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero';
}

/** 逐边修正量表格：原始分量、按轴修正量、平差后分量与权重。 */
export function CorrectionTable({ result }: Props) {
  let sumCx = 0;
  let sumCy = 0;
  let sumAx = 0;
  let sumAy = 0;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>id</th>
            <th>weight</th>
            <th>dx</th>
            <th>cx</th>
            <th>dy</th>
            <th>cy</th>
            <th>平差 dx</th>
            <th>平差 dy</th>
          </tr>
        </thead>
        <tbody>
          {result.edges.map((e, i) => {
            sumCx += e.cx;
            sumCy += e.cy;
            sumAx += e.ax;
            sumAy += e.ay;
            return (
              <tr key={e.id}>
                <td>{i + 1}</td>
                <td>{e.id}</td>
                <td>{e.weight}</td>
                <td>{e.dx}</td>
                <td className={cls(e.cx)}>{signed(e.cx)}</td>
                <td>{e.dy}</td>
                <td className={cls(e.cy)}>{signed(e.cy)}</td>
                <td>{e.ax}</td>
                <td>{e.ay}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>合计（严格不变量）</td>
            <td className={cls(sumCx)}>{signed(sumCx)}</td>
            <td />
            <td className={cls(sumCy)}>{signed(sumCy)}</td>
            <td>{sumAx}</td>
            <td>{sumAy}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
