#!/usr/bin/env node
'use strict'
/**
 * v1.0.2 后续数据精修（四）：★ 级差异批次（ICAO 改动 + 坐标位移）。
 *
 * A. 18 条 ICAO 改动：目标行身份逐条经上游英文名核验，15 条双源、3 条仅 OA（按矩阵）。
 * B. 7 条错码连环案（双源可证）：
 *    吐鲁番交河 ZWTN→ZWTL（ZWTN 是和田的）；花莲 RCBS→RCYU（金门的）；
 *    金门尚义 RCQC→RCBS（马公的）；澎湖马公 RCMT→RCQC（马祖北竿的）；
 *    乌兰巴托 ULA/ZMUL→UBN/ZMCK（阿根廷/乌列盖的）；甲米 VTCB→VTSG（清堪的）；
 *    阿坝红原 ABH/ZUAH→AHJ/ZUHY（澳洲 Alpha 的）。连带坐标/海拔取真身行。
 * C. 120 条坐标位移（排除 B 的 7 条——其位移目标本身被错码污染）。
 * 记录动态定位于 data-*.json；幂等：A/B 校验旧码，C 校验坐标快照。一次性脚本。
 */
const fs = require('fs')
const path = require('path')
const ft2m = (ft) => Math.round(ft * 0.3048)

const ROOT = path.join(__dirname, '..')
const DATA_FILES = fs.readdirSync(ROOT).filter((f) => /^data-.*\.json$/.test(f)).sort()

function mutate(nameZh, fn) {
  for (const f of DATA_FILES) {
    const p = path.join(ROOT, f)
    const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
    const r = arr.find((x) => x.nameZh === nameZh)
    if (r) {
      fn(r)
      fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n')
      return
    }
  }
  throw new Error('找不到记录: ' + nameZh)
}

// ---- Section B：错码连环案 ----
const SPECIAL = [
  { nameZh: '吐鲁番交河机场', expect: { icao: 'ZWTN' }, set: { icao: 'ZWTL', lat: 43.0308, lng: 89.0987, elevM: ft2m(934) } },
  { nameZh: '花莲机场', expect: { icao: 'RCBS' }, set: { icao: 'RCYU', lat: 24.023163, lng: 121.617991, elevM: ft2m(52) } },
  { nameZh: '金门尚义机场', expect: { icao: 'RCQC' }, set: { icao: 'RCBS', lat: 24.4279, lng: 118.359001, elevM: ft2m(93) } },
  { nameZh: '澎湖马公机场', expect: { icao: 'RCMT' }, set: { icao: 'RCQC', lat: 23.568701, lng: 119.627998, elevM: ft2m(103) } },
  { nameZh: '乌兰巴托成吉思汗国际机场', expect: { icao: 'ZMUL', iata: 'ULA' }, set: { icao: 'ZMCK', iata: 'UBN', lat: 47.646916, lng: 106.819833, elevM: ft2m(4482) } },
  { nameZh: '甲米国际机场', expect: { icao: 'VTCB' }, set: { icao: 'VTSG', lat: 8.095591, lng: 98.988955, elevM: ft2m(82) } },
  { nameZh: '阿坝红原机场', expect: { icao: 'ZUAH', iata: 'ABH' }, set: { icao: 'ZUHY', iata: 'AHJ', lat: 32.53154, lng: 102.35224, elevM: ft2m(11600) } },
]
for (const s of SPECIAL) {
  mutate(s.nameZh, (r) => {
    for (const [k, want] of Object.entries(s.expect)) {
      if (r[k] !== want) throw new Error(`${s.nameZh}: 旧 ${k}=${r[k]} ≠ ${want}，已非原始状态，中止`)
    }
    Object.assign(r, s.set)
  })
  console.log(`B ${s.nameZh}: ${JSON.stringify(s.set)}`)
}

// ---- Section A：18 条 ICAO 改动 ----
const ICAO_FIXES = [
  ['秦皇岛北戴河机场', 'ZBSD', 'ZBDH'],
  ['长治王村机场', 'ZBCP', 'ZBCZ'],
  ['巴彦淖尔天吉泰机场', 'ZBYL', 'ZBYZ'],
  ['朝阳机场', 'ZYZX', 'ZYCY'],
  ['白山长白山机场', 'ZYNB', 'ZYBS'],
  ['白城长安机场', 'ZYBC', 'ZYBA'],
  ['阜阳机场', 'ZSFU', 'ZSFY'],
  ['吉安井冈山机场', 'ZSJM', 'ZSGS'],
  ['邵阳武冈机场', 'ZGWG', 'ZGSY'],
  ['柳州白莲机场', 'ZGLZ', 'ZGZH'],
  ['达州金垭机场', 'ZUDY', 'ZUDX'],
  ['铜仁凤凰机场', 'ZUTL', 'ZUTR'],
  ['林芝米林机场', 'ZUNL', 'ZUNZ'],
  ['和田昆冈机场', 'ZWWT', 'ZWTN'],
  ['台中清泉岗机场', 'RCQM', 'RCMQ'],
  ['泗水朱安达国际机场', 'WRSJ', 'WARR'],
  ['科威特国际机场', 'OKBK', 'OKKK'],
  ['塔什干国际机场', 'UTTT', 'UZTT'],
]
for (const [nameZh, from, to] of ICAO_FIXES) {
  mutate(nameZh, (r) => {
    if (r.icao !== from) throw new Error(`${nameZh}: 旧 icao=${r.icao} ≠ ${from}，中止`)
    r.icao = to
  })
}
console.log(`A ICAO 修正 ${ICAO_FIXES.length} 条`)

// ---- Section C：坐标位移（排除 B 的 7 条） ----
const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, 'stars-context.json'), 'utf8'))
const EXCLUDE = new Set(SPECIAL.map((s) => s.nameZh))
let applied = 0
let excluded = 0
for (const x of ctx.filter((i) => i.field === 'lat/lng')) {
  if (EXCLUDE.has(x.nameZh)) { excluded++; continue }
  const [fromLat, fromLng] = x.from.split(',').map(Number)
  const [lat, lng] = x.to.split(',').map(Number)
  mutate(x.nameZh, (r) => {
    if (r.lat === lat && r.lng === lng) return
    if (r.lat !== fromLat || r.lng !== fromLng) throw new Error(`C 漂移: ${x.nameZh} 当前 ${r.lat},${r.lng} ≠ 快照 ${fromLat},${fromLng}`)
    r.lat = lat
    r.lng = lng
  })
  applied++
}
console.log(`C 坐标位移修正 ${applied} 条；排除错码案 ${excluded} 条`)
