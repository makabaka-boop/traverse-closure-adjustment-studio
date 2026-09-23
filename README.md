# 闭合导线平差工作台（离线纯前端）

闭合导线常因毫米级误差回不到起点。人工把闭合差平均分给各边会破坏整数精度，
也忽略各边的观测权重。本工具在浏览器中完成**按权最大余数法**整数平差：
修正量恒为整数毫米，东西 / 南北两轴独立分配，修正后两轴整数和**严格为零**，
每一步都可逐毫米复算。

## 功能

- **严格输入校验**：3–200 条顺序边；唯一非空 ASCII `id`、整数 `dx`/`dy`
  （绝对值 ≤ 10⁶）、正整数 `weight`。任何非法字段、重复 id 或结构错误都
  **拒绝整份数据**，画布与表格继续保留上一份有效图形。
- **按权最大余数分配（两轴独立）**
  1. 闭合差 T = Σ 分量，需分配的修正总量为 −T；
  2. 每条边先取欧几里得整除的**下整商** `floor((wᵢ·|T|) / W)`；
  3. 剩余 R 个单位（0 ≤ R < n）分给**余数较大者**；余数相同按 id 的
     **UTF-8 字节序**（小者先得）；
  4. 按 −T 的符号整体取号。全程 `bigint` 精确计算，无浮点误差，
     并断言 `Σcorrection === −T`。
- **叠画折线**：红为原始观测（红虚线标出未闭合缺口），绿为平差后路线，
  终点严格回到起点。
- **修正量表格**：每边 `cx` / `cy`、平差后分量，页脚给出严格合计。
- **导出与分享**：下载可复算 JSON（含闭合差、base / remainder / extra
  全部分配明细与不变量）；画布 PNG 走系统文件分享，不支持时退化为下载。
- **完全离线**：构建产物不含任何外链脚本、样式、字体或接口请求；
  nginx 附加 `default-src 'none'` 系列 CSP 头。

## 输入格式

JSON 边数组，或 `{ "edges": [...] }`：

```json
{
  "edges": [
    { "id": "E1", "dx": 1003, "dy": 2, "weight": 1 },
    { "id": "E2", "dx": -2, "dy": 1504, "weight": 2 },
    { "id": "E3", "dx": -1001, "dy": -1, "weight": 3 },
    { "id": "E4", "dx": -3, "dy": -1501, "weight": 4 }
  ]
}
```

## 本地开发

```bash
npm install
npm run dev       # Vite 开发服务器
npm test          # Vitest：负闭合差 / 同余数 UTF-8 裁决 / 总和不变量
npm run build     # 类型检查 + 产物到 dist/
npm run preview   # 本地预览构建产物
```

## Docker Compose 运行

```bash
docker compose up -d --build
# 打开 http://localhost:8080
```

多阶段构建：`node:20-alpine` 产出静态文件，`nginx:1.27-alpine` 托管，
容器只读根文件系统并带健康检查。运行期无需网络。

## 复算口径

- 所有分配量在导出 JSON 中以十进制字符串给出（避免大整数歧义）：
  `numerator = wᵢ·|T|`、`base = floor(numerator / W)`、
  `remainder = numerator − base·W`、`correction = sign·(base + extra)`。
- `invariant.sumCx` / `sumCy` 恒等于各自目标，
  `invariant.adjustedSumX` / `adjustedSumY` 恒为 `0`。
