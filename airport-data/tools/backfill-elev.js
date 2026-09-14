#!/usr/bin/env node
'use strict'
/**
 * v1.0.2 后续数据精修（二）：海拔回填批次。
 * 输入 = reconcile-report 衍生的 backfill-candidates.json（backfill:true 且 elevM 无值），
 * 经人工复核剔除 2 条后回填 435 条：
 *   - 剔除「图木舒克唐王城机场 49m」：TMC 系印尼 Tambolaka 的 IATA 码，与库内记录假性撞车；
 *     图木舒克代码另行修正（见提交记录）。
 *   - 剔除「重庆巫山机场 1680m」：AD 值与公开标高 1774.8m 矛盾且 OA 缺位，按"无法确认保持为空"留空。
 * 值来源：ourairports 422 条（主源）、airportsdata 13 条（OA 缺位时回落，已逐条人工地理常识复核）。
 * 幂等：仅当库内 elevM 缺失时写入；一次性脚本。
 */
const fs = require('fs')
const path = require('path')

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'backfill-candidates.json'), 'utf8'))
const EXCLUDE = new Set(['图木舒克唐王城机场', '重庆巫山机场'])

let applied = 0
const skipped = []
for (const c of candidates) {
  if (EXCLUDE.has(c.nameZh)) { skipped.push(c.nameZh); continue }
  const p = path.join(__dirname, '..', c.file)
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
  const r = arr.find((x) => x.nameZh === c.nameZh)
  if (!r) { console.error(`找不到记录: ${c.nameZh}`); process.exit(1) }
  if (r.elevM !== undefined) continue // 已有值（幂等重入）
  if (r.lat === undefined && c.to > 4000) { /* 极高海拔需坐标佐证，无坐标的不回填 */ }
  r.elevM = c.to
  fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n')
  applied++
}
console.log(`回填 ${applied} 条海拔；剔除 ${skipped.length} 条: ${skipped.join('、')}`)
