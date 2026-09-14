#!/usr/bin/env node
/**
 * 机场数据管道：合并 data-*.json → 校验 → 产出
 *   app/src/static/airports.json   内置离线包（随 APP 打包，不含内部核对字段 caacRef）
 *   app/src/dbversion.json         内置数据版本信息
 *   dist/manifest.json             远端更新清单（静态托管）
 *   dist/airports-<version>.json   远端更新数据包（静态托管）
 *
 * v1.0.2 门禁：caacRef 恰好 270 条且与民航局名录登记表一一对应；
 * 数据契约：仅 nameZh/country 必填，其余字段可选（缺失即键缺省，禁止伪造零值）。
 *
 * 用法：node build.js [版本号] [资料截至YYYY-MM-DD] [核验日期YYYY-MM-DD]
 *   版本号默认 YYYY.M.N；本管道完全离线，只读仓库内数据。
 */
const fs = require('fs')
const path = require('path')
// v1.1.1 §6.1：拼音仅构建期生成（pinyin-pro@3.29.4，MIT），不进入客户端运行依赖
const { pinyin } = require('pinyin-pro')

const ROOT = __dirname
const now = new Date()
const DEFAULT_VERSION = `${now.getFullYear()}.${now.getMonth() + 1}.1`
const version = process.argv[2] || DEFAULT_VERSION
if (!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(version)) {
  console.error(`非法版本号: ${version}（应为 YYYY.M.N）`)
  process.exit(1)
}
const dateArg = (i, dflt) => (/^\d{4}-\d{2}-\d{2}$/.test(process.argv[i] || '') ? process.argv[i] : dflt)
const dataAsOf = dateArg(3, '2026-09-14')
const verifiedAt = dateArg(4, '2026-09-14')

// 结构化数据来源（与 SOURCES.md 一致；登记表快照见 caac-registry.json）
const SOURCES = [
  {
    name: 'airportsdata',
    url: 'https://github.com/mborsetti/airportsdata',
    license: 'MIT',
    usage: '机场基础字段（代码/英文名/坐标/时区/海拔）',
  },
  {
    name: 'ourairports-data',
    url: 'https://github.com/davidmegginson/ourairports-data',
    license: 'Unlicense',
    usage: '基础字段交叉核对与补齐',
  },
  {
    name: 'caac',
    url: 'https://www.caac.gov.cn/GYMH/MHGK/MYJC/',
    license: '政府公开信息（仅人工事实核对与引用）',
    usage: '境内 270 机场名录核对与更名',
  },
]

// 1. 合并
const files = fs.readdirSync(ROOT).filter((f) => /^data-.*\.json$/.test(f)).sort()
if (files.length === 0) {
  console.error('未找到 data-*.json 源数据文件')
  process.exit(1)
}
let all = []
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
  if (!Array.isArray(arr)) throw new Error(`${f} 不是数组`)
  all = all.concat(arr.map((r) => ({ ...r, __src: f })))
}
console.log(`合并 ${files.length} 个文件，共 ${all.length} 条记录`)

// 2. 校验（v1.0.2 契约：仅中文名与国家必填）
const errors = []
const seenIata = new Map()
const seenIcao = new Map()
const seenNameZhCn = new Map()
const REQUIRED = ['nameZh', 'country']
const OPTIONAL_STRINGS = ['iata', 'icao', 'nameEn', 'cityZh', 'cityEn', 'tz']
const isHMT = (r) => r.icao && /^(VH|VM|R)/.test(r.icao)

for (const r of all) {
  const tag = `${r.__src} ${r.iata || r.icao || r.nameZh || '?'}`
  for (const k of REQUIRED) {
    if (typeof r[k] !== 'string' || !r[k].trim()) errors.push(`${tag}: 缺少必填 ${k}`)
  }
  for (const k of OPTIONAL_STRINGS) {
    if (r[k] === undefined || r[k] === null) continue
    if (typeof r[k] !== 'string' || !r[k].trim()) errors.push(`${tag}: 可选字段 ${k} 为空串/null（应整体省略）`)
  }
  if (r.iata) {
    if (!/^[A-Z]{3}$/.test(r.iata)) errors.push(`${tag}: IATA 格式非法`)
    if (seenIata.has(r.iata)) errors.push(`${tag}: IATA ${r.iata} 与 ${seenIata.get(r.iata)} 重复`)
    seenIata.set(r.iata, tag)
  }
  if (r.icao) {
    if (!/^[A-Z]{4}$/.test(r.icao)) errors.push(`${tag}: ICAO 格式非法`)
    if (seenIcao.has(r.icao)) errors.push(`${tag}: ICAO ${r.icao} 与 ${seenIcao.get(r.icao)} 重复`)
    seenIcao.set(r.icao, tag)
  }
  if (r.lat !== undefined && (typeof r.lat !== 'number' || r.lat < -90 || r.lat > 90)) errors.push(`${tag}: lat 非法`)
  if (r.lng !== undefined && (typeof r.lng !== 'number' || r.lng < -180 || r.lng > 180)) errors.push(`${tag}: lng 非法`)
  if (r.elevM !== undefined && (typeof r.elevM !== 'number' || !Number.isFinite(r.elevM))) errors.push(`${tag}: elevM 非法`)
  if (r.aliases !== undefined) {
    if (!Array.isArray(r.aliases) || r.aliases.some((x) => typeof x !== 'string' || !x.trim())) {
      errors.push(`${tag}: aliases 非法`)
    }
  }
  if (r.country === '中国') {
    if (seenNameZhCn.has(r.nameZh)) errors.push(`${tag}: 中国机场中文名与 ${seenNameZhCn.get(r.nameZh)} 重复`)
    seenNameZhCn.set(r.nameZh, tag)
  }
  if (r.caacRef !== undefined && isHMT(r)) errors.push(`${tag}: 港澳台机场不得携带 caacRef`)
}

// 3. 名录覆盖门禁：caacRef 恰好 270 条且与登记表一一对应
const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'caac-registry.json'), 'utf8'))
const refToName = new Map()
for (const p of registry.pages) {
  if (!Array.isArray(p.entries) || p.entries.length !== 10) errors.push(`登记表第 ${p.page} 页条数非 10`)
  p.entries.forEach((e, i) => {
    const ref = `p${String(p.page).padStart(2, '0')}e${String(i + 1).padStart(2, '0')}`
    if (refToName.has(ref)) errors.push(`登记表 ref 重复: ${ref}`)
    refToName.set(ref, e.name)
  })
}
if (refToName.size !== 270) errors.push(`登记表条目 ${refToName.size} ≠ 270`)

const refd = all.filter((r) => r.caacRef !== undefined)
const usedRefs = new Set()
for (const r of refd) {
  const want = refToName.get(r.caacRef)
  if (!want) errors.push(`${r.__src} ${r.nameZh}: caacRef ${r.caacRef} 不在登记表`)
  else if (want !== r.nameZh) errors.push(`${r.__src} ${r.nameZh}: caacRef ${r.caacRef} 对应登记表名称「${want}」`)
  if (usedRefs.has(r.caacRef)) errors.push(`caacRef ${r.caacRef} 重复使用`)
  usedRefs.add(r.caacRef)
}
if (refd.length !== 270) errors.push(`caacRef 记录 ${refd.length} ≠ 270`)
const missingOnRegistry = [...refToName.values()].filter((n) => !seenNameZhCn.has(n))
if (missingOnRegistry.length) errors.push(`登记表名称未入库: ${missingOnRegistry.join('、')}`)

const coverage = { expected: refToName.size, matched: refd.length, asOf: registry.source.asOf }

if (errors.length) {
  console.error(`校验失败 ${errors.length} 处：`)
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(`校验通过：境内运输机场 ${coverage.matched}/${coverage.expected}（截至 ${coverage.asOf}），总记录 ${all.length}`)

// 4. 清洗输出字段（去掉 __src 与 caacRef），排序：中国在前，按城市/名称
const clean = all.map(({ __src, caacRef, ...r }) => r)
const cnRank = (r) => (r.country === '中国' ? 0 : 1)
clean.sort(
  (a, b) =>
    cnRank(a) - cnRank(b) ||
    a.country.localeCompare(b.country, 'zh') ||
    (a.cityZh || '').localeCompare(b.cityZh || '', 'zh') ||
    a.nameZh.localeCompare(b.nameZh, 'zh')
)

// 4.5 构建期拼音搜索字段（v1.1.1 §6.1）：py=全拼、pj=拼音首字母，
// 段间 | 分隔（机场名/城市/曾用名），小写；客户端仅做字符串匹配，不含拼音库。
const zhSegments = (r) => [r.nameZh, r.cityZh, ...(r.aliases || [])].filter(Boolean)
const fullPy = (s) =>
  pinyin(s, { toneType: 'none', type: 'array', nonZh: 'consecutive' }).join('').toLowerCase()
const firstPy = (s) =>
  pinyin(s, { pattern: 'first', toneType: 'none', type: 'array', nonZh: 'consecutive' })
    .join('')
    .toLowerCase()
for (const r of clean) {
  const segs = zhSegments(r)
  r.py = segs.map(fullPy).join('|')
  r.pj = segs.map(firstPy).join('|')
}

// 4.6 构建期时区偏移查表（v1.1.1 §6.4）：微信小程序 iOS 端 JSCore 的 Intl 时区支持
// 不完整，偏移在构建期（本机 Node 含完整 ICU，过程离线）按天采样生成跳变表；
// 客户端只查表，不依赖运行时 Intl。窗口外沿用端点偏移（显示用途可接受）。
// 窗口自 2026-01-01 起：覆盖设备时钟略偏与"当前"回看场景，窗口前钳到端点
const TZ_FROM = new Date(Date.UTC(2026, 0, 1))
const TZ_TO = new Date(Date.UTC(2028, 11, 31))
const dayNumUtc = (d) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
const gmtPartToMinutes = (gmt) => {
  // 'GMT+08:00' | 'GMT-04:30' | 'GMT'；返回"东经正"分钟数（UTC+8 → +480）
  const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(gmt)
  if (!m) return 0
  return (m[1] === '+' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3]))
}
const tzNames = [...new Set(all.map((r) => r.tz).filter(Boolean))].sort()
const zones = {}
let tzFailed = 0
for (const tz of tzNames) {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const offsetAt = (d) =>
      gmtPartToMinutes(fmt.formatToParts(d).find((p) => p.type === 'timeZoneName').value)
    const transitions = []
    let prev = null
    for (let t = TZ_FROM.getTime(); t <= TZ_TO.getTime(); t += 86400000) {
      const d = new Date(t)
      const off = offsetAt(d)
      if (off !== prev) {
        transitions.push([dayNumUtc(d), off])
        prev = off
      }
    }
    // 标准偏移 = 各偏移中的最小值：夏令时总是"拨快"使偏移增大（爱尔兰负夏令时
    // 惯例下标准 GMT 同为最小），众数法在现代 tzdata（美国夏令时已占全年 ~66%）失效
    let std = transitions[0][1]
    for (const [, off] of transitions) {
      if (off < std) std = off
    }
    zones[tz] = { std, t: transitions }
  } catch {
    tzFailed += 1
    console.warn(`警告：时区 ${tz} 偏移生成失败，客户端将显示"当前偏移不可用"`)
  }
}
const tzTransitions = Object.values(zones).reduce((n, z) => n + z.t.length, 0)

// 5. 产出
const pad = (n) => String(n).padStart(2, '0')
const updatedAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
const count = clean.length

// 字段完整率（%）：如实统计，仅存在于数据清单，不上应用界面
const FIELDS = ['iata', 'icao', 'nameZh', 'nameEn', 'cityZh', 'cityEn', 'lat', 'lng', 'elevM', 'tz']
const completeness = {}
for (const f of FIELDS) {
  const present = clean.filter((r) => r[f] !== undefined && r[f] !== null && r[f] !== '').length
  completeness[f] = Math.round((present / count) * 100)
}

const dbVersion = { version, count, updatedAt, sources: SOURCES, dataAsOf, verifiedAt, coverage, completeness }
fs.writeFileSync(path.join(ROOT, '..', 'app', 'src', 'dbversion.json'), JSON.stringify(dbVersion, null, 2) + '\n')
fs.writeFileSync(
  path.join(ROOT, '..', 'app', 'src', 'static', 'airports.json'),
  JSON.stringify(clean)
)
fs.writeFileSync(
  path.join(ROOT, '..', 'app', 'src', 'static', 'tzoffsets.json'),
  JSON.stringify({ window: { from: dayNumUtc(TZ_FROM), to: dayNumUtc(TZ_TO) }, zones })
)

const distDir = path.join(ROOT, 'dist')
fs.mkdirSync(distDir, { recursive: true })
const dataFile = `airports-${version}.json`
fs.writeFileSync(path.join(distDir, dataFile), JSON.stringify(clean))
fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(
    { version, count, updatedAt, file: dataFile, sources: SOURCES, dataAsOf, verifiedAt, coverage, completeness },
    null,
    2
  ) + '\n'
)

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1) + 'KB'
console.log('产出：')
console.log(`  app/src/static/airports.json  (${kb(path.join(ROOT, '..', 'app', 'src', 'static', 'airports.json'))})`)
console.log(`  app/src/static/tzoffsets.json  时区 ${Object.keys(zones).length} 个、跳变 ${tzTransitions} 条${tzFailed ? `（失败 ${tzFailed}）` : ''}`)
console.log(`  app/src/dbversion.json        version=${version} count=${count} verifiedAt=${verifiedAt}`)
console.log(`  dist/${dataFile} (${kb(path.join(distDir, dataFile))})`)
console.log(`  dist/manifest.json`)
console.log('字段完整率（%）:', completeness)
