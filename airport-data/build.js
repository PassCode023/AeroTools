#!/usr/bin/env node
/**
 * 机场数据管道：合并 data-*.json → 校验 → 产出
 *   app/src/static/airports.json   内置离线包（随 APP 打包）
 *   app/src/dbversion.json         内置数据版本信息
 *   dist/manifest.json             远端更新清单（静态托管）
 *   dist/airports-<version>.json   远端更新数据包（静态托管）
 *
 * 用法：node build.js [版本号]   版本号默认 YYYY.M.N
 */
const fs = require('fs')
const path = require('path')

const ROOT = __dirname
const now = new Date()
const DEFAULT_VERSION = `${now.getFullYear()}.${now.getMonth() + 1}.1`
const version = process.argv[2] || DEFAULT_VERSION
if (!/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(version)) {
  console.error(`非法版本号: ${version}（应为 YYYY.M.N）`)
  process.exit(1)
}

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

// 2. 校验
const errors = []
const seenIata = new Map()
const seenIcao = new Map()
const REQUIRED = ['nameZh', 'nameEn', 'cityZh', 'cityEn', 'country', 'tz']
for (const r of all) {
  const tag = `${r.__src} ${r.iata || r.icao || '?'}`
  if (r.iata && !/^[A-Z]{3}$/.test(r.iata)) errors.push(`${tag}: IATA 格式非法`)
  if (r.icao && !/^[A-Z]{4}$/.test(r.icao)) errors.push(`${tag}: ICAO 格式非法`)
  if (!r.iata && !r.icao) errors.push(`${tag}: IATA 与 ICAO 均为空`)
  for (const k of REQUIRED) {
    if (typeof r[k] !== 'string' || !r[k].trim()) errors.push(`${tag}: 缺少 ${k}`)
  }
  if (typeof r.lat !== 'number' || r.lat < -90 || r.lat > 90) errors.push(`${tag}: lat 非法`)
  if (typeof r.lng !== 'number' || r.lng < -180 || r.lng > 180) errors.push(`${tag}: lng 非法`)
  if (r.iata) {
    if (seenIata.has(r.iata)) errors.push(`${tag}: IATA ${r.iata} 与 ${seenIata.get(r.iata)} 重复`)
    seenIata.set(r.iata, tag)
  }
  if (r.icao) {
    if (seenIcao.has(r.icao)) errors.push(`${tag}: ICAO ${r.icao} 与 ${seenIcao.get(r.icao)} 重复`)
    seenIcao.set(r.icao, tag)
  }
}
const cnCount = all.filter((r) => r.country === '中国').length
if (cnCount < 240) errors.push(`中国机场数量 ${cnCount} < 240，疑似数据缺失`)
if (all.length < 500) errors.push(`总数量 ${all.length} < 500，疑似数据缺失`)
if (errors.length) {
  console.error(`校验失败 ${errors.length} 处：`)
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}
console.log(`校验通过：中国 ${cnCount} 家，全球其他 ${all.length - cnCount} 家`)

// 3. 清洗输出字段（去掉 __src），排序：中国在前，按城市/名称
const clean = all.map(({ __src, ...r }) => r)
const cnRank = (r) => (r.country === '中国' ? 0 : 1)
clean.sort(
  (a, b) =>
    cnRank(a) - cnRank(b) ||
    a.country.localeCompare(b.country, 'zh') ||
    a.cityZh.localeCompare(b.cityZh, 'zh') ||
    a.nameZh.localeCompare(b.nameZh, 'zh')
)

// 4. 产出
const updatedAt = now.toISOString().slice(0, 19).replace('T', ' ')
const count = clean.length

const dbVersion = { version, count, updatedAt }
fs.writeFileSync(path.join(ROOT, '..', 'app', 'src', 'dbversion.json'), JSON.stringify(dbVersion, null, 2))
fs.writeFileSync(
  path.join(ROOT, '..', 'app', 'src', 'static', 'airports.json'),
  JSON.stringify(clean)
)

const distDir = path.join(ROOT, 'dist')
fs.mkdirSync(distDir, { recursive: true })
const dataFile = `airports-${version}.json`
fs.writeFileSync(path.join(distDir, dataFile), JSON.stringify(clean))
fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify({ version, count, updatedAt, file: dataFile }, null, 2)
)

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1) + 'KB'
console.log('产出：')
console.log(`  app/src/static/airports.json  (${kb(path.join(ROOT, '..', 'app', 'src', 'static', 'airports.json'))})`)
console.log(`  app/src/dbversion.json        version=${version} count=${count}`)
console.log(`  dist/${dataFile} (${kb(path.join(distDir, dataFile))})`)
console.log(`  dist/manifest.json`)
