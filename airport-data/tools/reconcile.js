#!/usr/bin/env node
'use strict'
/**
 * 离线对账：更新线索报告（计划 §3.3“字段冲突、名称变更、旧名、缺失字段”的机器可复现部分）。
 *
 *  1. --caac  官方名录登记表（caac-registry.json，人工浏览维护）↔ 库内中文名覆盖与更名线索；
 *  2. --fields 上游两 CSV（fetch.js 人工下载存放于 raw/ 并登记于 SOURCES.md）↔ 库内现值，
 *     按 arbitrate.js 裁定矩阵给出字段级差异。
 *
 * 本脚本不修改任何数据文件：报告只是更新线索。回填/补录/改名必须人工确认后改 data-*.json
 * （新入名录者同时补 caacRef，官方更名者旧名进 aliases），再 node build.js 过门禁。
 *
 * 用法：node tools/reconcile.js          两章全跑（缺 raw/ 时第二章自动跳过）
 *       node tools/reconcile.js --caac / --fields
 */
const fs = require('fs')
const path = require('path')
const { parseCsv } = require('./csv.js')
const { fromOurAirports, fromAirportsdata } = require('./sources.js')
const { mergeAirportRecords, hasValue } = require('./arbitrate.js')

const DATA_ROOT = path.join(__dirname, '..')
const MODE = process.argv[2] || 'all'

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const loadCurated = () => {
  const files = fs.readdirSync(DATA_ROOT).filter((f) => /^data-.*\.json$/.test(f)).sort()
  const out = []
  for (const f of files) {
    for (const r of readJson(path.join(DATA_ROOT, f))) out.push({ __source: 'manual', __file: f, ...r })
  }
  return out
}

/** 境内/港澳台判别：ICAO 前缀 Z=内地；VH=港；VM=澳；RC=台。无代码时按知名地名兜底。 */
function cnRegion(rec) {
  const icao = (rec.icao || '').toUpperCase()
  if (icao.startsWith('VH')) return 'HK'
  if (icao.startsWith('VM')) return 'MO'
  if (icao.startsWith('RC')) return 'TW'
  if (icao.startsWith('Z')) return 'mainland'
  const s = `${rec.nameZh || ''}${rec.cityZh || ''}`
  if (/港|九龍|大嶼/.test(s)) return 'HK'
  if (/澳門|氹仔/.test(s)) return 'MO'
  if (/台湾|台北|高雄|台中|桃園|台南|台東|花蓮|金門|馬公/.test(s)) return 'TW'
  return 'unknown'
}

const normName = (s) => (s || '').replace(/机场$/, '').replace(/国际$/, '').trim()
/** 疑似更名启发：规范化后前二字相同（城市前缀）或一方包含另一方 */
function renameLikely(a, b) {
  const x = normName(a)
  const y = normName(b)
  if (!x || !y) return false
  return x.slice(0, 2) === y.slice(0, 2) || x.includes(y) || y.includes(x)
}

function sectionCaac(curated) {
  const reg = readJson(path.join(DATA_ROOT, 'caac-registry.json'))
  const official = []
  for (const p of reg.pages) {
    p.entries.forEach((e, i) =>
      official.push({ ref: `p${String(p.page).padStart(2, '0')}e${String(i + 1).padStart(2, '0')}`, name: e.name, province: e.province })
    )
  }
  const cn = curated.filter((r) => r.country === '中国')
  const dbByName = new Map()
  for (const r of cn) {
    const k = (r.nameZh || '').trim()
    if (!dbByName.has(k)) dbByName.set(k, r)
  }
  const matched = []
  const onlyOfficial = []
  for (const a of official) {
    const hit = dbByName.get(a.name.trim())
    if (hit) matched.push({ official: a.name, ref: a.ref, dbRef: hit.caacRef, iata: hit.iata || '', icao: hit.icao || '' })
    else onlyOfficial.push(a)
  }
  const matchedNames = new Set(matched.map((m) => m.official))
  const onlyDb = cn.filter((r) => !matchedNames.has((r.nameZh || '').trim()))
  const hkmt = []
  const mainlandRest = []
  for (const r of onlyDb) {
    const kind = cnRegion(r)
    if (kind === 'HK' || kind === 'MO' || kind === 'TW') hkmt.push(r.nameZh)
    else mainlandRest.push(r)
  }
  const renameGuess = []
  const unclassified = []
  for (const d of mainlandRest) {
    const cand = onlyOfficial.find((o) => renameLikely(d.nameZh, o.name))
    if (cand) renameGuess.push({ inDb: { nameZh: d.nameZh, iata: d.iata, icao: d.icao }, official: cand.name, province: cand.province })
    else unclassified.push({ nameZh: d.nameZh, iata: d.iata || '', icao: d.icao || '', caacRef: d.caacRef })
  }
  const refMismatch = matched.filter((m) => m.dbRef && m.dbRef !== m.ref)
  return {
    expected: official.length,
    asOf: reg.source.asOf,
    accessedAt: reg.source.accessedAt,
    matched: matched.length,
    refMismatch,
    missingInDb: onlyOfficial,
    hkMoTw: hkmt,
    suspectedRenames: renameGuess,
    extraInDbUnclassified: unclassified,
  }
}

function sectionFields(curated) {
  const need = [
    ['raw/ourairports-airports.csv', fromOurAirports],
    ['raw/airportsdata-airports.csv', fromAirportsdata],
  ]
  const upstream = []
  for (const [rel, map] of need) {
    const p = path.join(DATA_ROOT, rel)
    if (!fs.existsSync(p)) return { skipped: `${rel} 不存在——先人工运行 node tools/fetch.js` }
    upstream.push(...map(parseCsv(fs.readFileSync(p, 'utf8'))))
  }
  const coded = upstream.filter((r) => hasValue(r.icao) || hasValue(r.iata))
  const groups = mergeAirportRecords(curated.concat(coded))
  const byIcao = new Map()
  const byIata = new Map()
  for (const g of groups) {
    if (g.record.icao) byIcao.set(g.record.icao, g)
    if (g.record.iata) byIata.set(g.record.iata, g)
  }
  const out = { curatedTotal: curated.length, matchedUpstream: 0, noUpstreamMatch: [], changes: [] }
  for (const c of curated) {
    const g = (c.icao && byIcao.get(c.icao)) || (c.iata && byIata.get(c.iata)) || null
    if (!g) {
      out.noUpstreamMatch.push({ nameZh: c.nameZh, iata: c.iata || '', icao: c.icao || '', caacRef: c.caacRef })
      continue
    }
    out.matchedUpstream++
    const rec = g.record
    const prov = g.provenance
    const diffs = []
    if (hasValue(rec.icao) && hasValue(c.icao) && rec.icao !== c.icao)
      diffs.push({ field: 'icao', from: c.icao, to: rec.icao, via: prov.icao, severity: 'high' }) // ICAO 改动必须人工对 AIP 核实
    if (hasValue(rec.iata) && rec.iata !== (c.iata || '') && prov.iata !== 'manual')
      diffs.push({ field: 'iata', from: c.iata || '', to: rec.iata, via: prov.iata })
    for (const f of ['nameEn', 'cityEn', 'tz']) {
      if (hasValue(rec[f]) && (c[f] || '') !== rec[f] && prov[f] !== 'manual')
        diffs.push({ field: f, from: c[f] || '', to: rec[f], via: prov[f] })
    }
    const dLat = hasValue(rec.lat) && hasValue(c.lat) ? Math.abs(rec.lat - c.lat) : 0
    const dLng = hasValue(rec.lng) && hasValue(c.lng) ? Math.abs(rec.lng - c.lng) : 0
    if (dLat > 0.001 || dLng > 0.001) {
      // Δ>0.05°（约 5.5km）视为坐标位移冲突；0.001°~0.05° 多为旧记录两位小数取整的精度升级
      const moved = Math.max(dLat, dLng) > 0.05
      diffs.push({ field: 'lat/lng', from: `${c.lat},${c.lng}`, to: `${rec.lat},${rec.lng}`, via: prov.lat, severity: moved ? 'high' : 'precisionUpgrade' })
    }
    if (hasValue(rec.elevM) && c.elevM == null)
      diffs.push({ field: 'elevM', from: '', to: rec.elevM, via: prov.elevM, backfill: true })
    else if (hasValue(rec.elevM) && hasValue(c.elevM) && Math.abs(rec.elevM - c.elevM) >= 1)
      diffs.push({ field: 'elevM', from: c.elevM, to: rec.elevM, via: prov.elevM })
    if (diffs.length) out.changes.push({ id: `${c.iata || ''}/${c.icao || ''}`, nameZh: c.nameZh, file: c.__file, diffs })
  }
      out.elevBackfills = out.changes.reduce((n, x) => n + x.diffs.filter((d) => d.backfill).length, 0)
      out.precisionUpgrades = out.changes.reduce((n, x) => n + x.diffs.filter((d) => d.severity === 'precisionUpgrade').length, 0)
  return out
}

function main() {
  const curated = loadCurated()
  const report = { generatedAt: new Date().toISOString().slice(0, 10), curatedCount: curated.length }

  if (MODE === 'all' || MODE === '--caac') {
    const r = sectionCaac(curated)
    report.caac = r
    console.log(`【CAAC 名录覆盖】登记表 ${r.expected} 个（截至 ${r.asOf}，核对于 ${r.accessedAt}）`)
    console.log(`  精确命中 ${r.matched}，ref 错位 ${r.refMismatch.length}，待补录 ${r.missingInDb.length}，疑似更名 ${r.suspectedRenames.length}，未归类 ${r.extraInDbUnclassified.length}，港澳台 ${r.hkMoTw.length}`)
    for (const m of r.missingInDb) console.log(`  待补录：${m.name}（${m.province}，ref ${m.ref}）`)
    for (const s of r.suspectedRenames) console.log(`  疑似更名：库内 ${s.inDb.nameZh} ↔ 名录 ${s.official}（${s.province}）`)
    for (const e of r.extraInDbUnclassified) console.log(`  未归类：${e.nameZh} ${e.iata}/${e.icao}（ref ${e.caacRef || '无'}）`)
    for (const x of r.refMismatch.slice(0, 10)) console.log(`  ref 错位：${x.official} 库内 ${x.dbRef} ≠ 登记表 ${x.ref}`)
  }
  if (MODE === 'all' || MODE === '--fields') {
    const r = sectionFields(curated)
    if (r.skipped) {
      console.log(`【字段级裁定】跳过：${r.skipped}`)
    } else {
      report.fields = r
      console.log(`【字段级裁定】上游带码记录并入后：匹配 ${r.matchedUpstream}/${r.curatedTotal}，无上游对应 ${r.noUpstreamMatch.length}`)
      console.log(`  差异记录 ${r.changes.length} 条：海拔回填候选 ${r.elevBackfills}、坐标精度升级 ${r.precisionUpgrades}（★ 为需人工核实的冲突）`)
      for (const c of r.noUpstreamMatch.slice(0, 10)) console.log(`  无上游对应：${c.nameZh} ${c.iata}/${c.icao}（可能停航/无码，人工核实）`)
      const high = r.changes.flatMap((c) => c.diffs.filter((d) => d.severity === 'high').map((d) => ({ c, d })))
      for (const { c, d } of high.slice(0, 30)) console.log(`  ★ ${c.id} ${c.nameZh}: ${d.field} ${d.from} → ${d.to}（${d.via}）`)
      if (high.length > 30) console.log(`  …高置信差异共 ${high.length} 处，其余见 JSON 报告`)
      console.log(`  其余字符串/回填类差异明细全部在 reconcile-report.json（${r.changes.length} 条）`)
    }
  }
  const p = path.join(DATA_ROOT, 'reconcile-report.json')
  fs.writeFileSync(p, JSON.stringify(report, null, 2) + '\n')
  console.log(`报告：${p}`)
}

main()
