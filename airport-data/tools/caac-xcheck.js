#!/usr/bin/env node
'use strict'
/**
 * CAAC 名录登记表独立交叉验证（审计工具，不改动数据）。
 * 场景：另一次人工逐页浏览产出快照后，与本登记表比对。站点 CDN 存在新旧快照混杂
 * （见 registry notes 2026-09-14），同一时刻不同分页槽位可能整体轮转——因此裁定分两层：
 *   集合级（270 条名称+省市属性）不一致 = 真实内容冲突 → exit 1，必须禁缓存直读官网仲裁；
 *   仅槽位（页/序）不一致 = 缓存快照漂移 → 警告 exit 0，登记表 caacRef 保持稳定编号，不跟槽位改。
 * 快照格式：{ airports: [{page, name, region, province}] }（region 允许带/不带“地区”后缀）。
 * 浏览动作本身必须人工进行（计划 §3.1，名录禁止提取脚本）；本工具只做本地比对。
 *
 * 用法：node tools/caac-xcheck.js <快照.json>
 */
const fs = require('fs')
const path = require('path')

const snapPath = process.argv[2]
if (!snapPath) {
  console.error('用法：node tools/caac-xcheck.js <快照.json>')
  process.exit(1)
}
const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'caac-registry.json'), 'utf8'))
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8'))

const normRegion = (x) => (x || '').replace(/地区$/, '')
const attr = (e) => `${normRegion(e.region)}|${e.province}`

// 登记表全序（槽位序）
const regFlat = []
for (const p of reg.pages) {
  p.entries.forEach((e, i) => regFlat.push({ slot: `p${String(p.page).padStart(2, '0')}e${String(i + 1).padStart(2, '0')}`, name: e.name, a: attr(e) }))
}
// 快照槽位
const slotDiffs = []
for (const r of regFlat) {
  const idx = regFlat.indexOf(r)
  const m = snap.airports[idx]
  if (!m) { slotDiffs.push(`${r.slot} 快照缺条目`); continue }
  if (r.name !== m.name || r.a !== attr(m)) {
    slotDiffs.push(`${r.slot}：登记表[${r.name}|${r.a}] vs 快照[${m.name}|${attr(m)}]`)
  }
}
// 集合比对（与槽位无关）
const regMap = new Map(regFlat.map((r) => [r.name, r.a]))
const snapMap = new Map(snap.airports.map((a) => [a.name, attr(a)]))
const setDiffs = []
for (const [n, a] of regMap) {
  if (!snapMap.has(n)) setDiffs.push(`仅登记表有：${n}（${a}）`)
  else if (snapMap.get(n) !== a) setDiffs.push(`属性冲突：${n} 登记表[${a}] vs 快照[${snapMap.get(n)}]`)
}
for (const n of snapMap.keys()) if (!regMap.has(n)) setDiffs.push(`仅快照有：${n}`)

console.log(`登记表 ${regFlat.length} 条 vs 快照 ${snap.airports.length} 条`)
console.log(`集合级差异：${setDiffs.length}`)
for (const d of setDiffs) console.log('  ★ ' + d)
if (setDiffs.length === 0) {
  console.log('  → 270 条名称与省市属性两源一致（快照为独立人工浏览所得）')
  if (slotDiffs.length) {
    console.log(`槽位级差异 ${slotDiffs.length} 处（不判为冲突——CDN 新旧快照混杂导致的整体轮转，登记表 ref 保持稳定编号）：`)
    for (const d of slotDiffs.slice(0, 12)) console.log('  - ' + d)
    if (slotDiffs.length > 12) console.log(`  …共 ${slotDiffs.length} 处`)
    console.log('处置：确认集合一致后，在 caac-registry.json notes 与 SOURCES.md 结论记录中注明本次交叉验证即可。')
  } else {
    console.log('槽位级差异：0（两源逐页逐位一致）')
  }
  process.exit(0)
}
console.log('结论：存在真实内容冲突，须人工禁缓存直读官网逐页仲裁，禁止脚本批量复核。')
process.exit(1)
