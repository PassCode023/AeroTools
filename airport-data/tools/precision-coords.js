#!/usr/bin/env node
'use strict'
/**
 * v1.0.2 后续数据精修（三）：坐标精度升级批次。
 * 输入 = reconcile-report 衍生 precision-candidates.json（severity:precisionUpgrade，
 * 即同址差异 Δ∈(0.001°,0.05°]，全部经由 ourairports 坐标权威源）。
 * 将库内两位小数量级坐标升级为权威源精确值；>0.05° 的位移冲突不在此列（需逐案人工研究）。
 * 幂等：仅当当前 lat/lng 与报告快照一致时写入。一次性脚本。
 */
const fs = require('fs')
const path = require('path')

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'precision-candidates.json'), 'utf8'))

let applied = 0
const drift = []
for (const c of candidates) {
  const p = path.join(__dirname, '..', c.file)
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
  const r = arr.find((x) => x.nameZh === c.nameZh)
  if (!r) { console.error(`找不到记录: ${c.nameZh}`); process.exit(1) }
  if (r.lat === c.lat && r.lng === c.lng) continue // 已应用（幂等重入）
  if (r.lat !== c.fromLat || r.lng !== c.fromLng) {
    drift.push(`${c.nameZh}: 当前 ${r.lat},${r.lng} ≠ 快照 ${c.fromLat},${c.fromLng}`)
    continue
  }
  r.lat = c.lat
  r.lng = c.lng
  fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n')
  applied++
}
console.log(`升级 ${applied} 条坐标；跳过快照漂移 ${drift.length} 条`)
drift.forEach((d) => console.log('  ' + d))
