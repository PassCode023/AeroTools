#!/usr/bin/env node
'use strict'
/**
 * v1.0.2 后续数据精修（一）：reconcile-report 首批 6 条"无上游对应"的人工裁定落地。
 *
 * 裁定依据 = tools/arbitrate.js 矩阵（icao/坐标/海拔: ourairports 优先；iata/时区: airportsdata 优先；
 * caac 管中文名事实；缺位来源回落次位）。逐案结论（上游证据见 SOURCES.md §处理结论）：
 *   1 河池金城江   icao ZGJJ→ZGHC（双源一致）；iata HCJ→HNI（AD 权威，OA=HCJ 不采）；
 *                  坐标→OA 精确值（旧值偏约 6km）；海拔 2221ft→677m（双源一致）
 *   2 三沙永兴     两上游均无此机场（军民合用未收录）→ 保留人工值 XYI/ZJYH，不改
 *   3 海西茫崖     icao ZLHT→ZLHX、iata HXG→HTT（AD 未收录，回落 OA）；坐标→OA（旧值偏约 17km）；
 *                  海拔 2945ft→898m；nameEn 保留现值（含 Mangya 检索词，OA 单词名为子集）
 *   4 且末玉都     icao ZWQM→ZWCM、iata QMX→IQM（双源一致）；坐标→OA（OA 名含 Yudu 与新址对应，
 *                  AD 坐标疑为老场址）；海拔 OA 缺→AD 4108ft→1253m
 *   5 若羌楼兰     iata RZX→RQA、icao 缺→ZWRQ（双源一致）；坐标→双源一致精确值（旧值偏约 17km）；
 *                  海拔 OA 2916ft→889m
 *   6 比什凯克玛纳斯 iata FRU→BSZ、icao UAFM→UCFM（双源一致；吉尔吉斯斯坦 2024 换码，OA keywords
 *                  保留旧码为证）；坐标→OA 精确值；海拔 OA 2058ft→627m
 * 一次性脚本，幂等（改前校验旧值）。
 */
const fs = require('fs')
const path = require('path')
const ft2m = (ft) => Math.round(ft * 0.3048)

const EDITS = [
  {
    file: 'data-cn-2.json', nameZh: '河池金城江机场',
    set: { icao: 'ZGHC', iata: 'HNI', lat: 24.804344, lng: 107.710819, elevM: ft2m(2221) },
    expect: { icao: 'ZGJJ', iata: 'HCJ' },
  },
  {
    file: 'data-cn-3.json', nameZh: '海西茫崖机场',
    set: { icao: 'ZLHX', iata: 'HTT', lat: 38.201645, lng: 90.837843, elevM: ft2m(2945) },
    expect: { icao: 'ZLHT', iata: 'HXG' },
  },
  {
    file: 'data-cn-3.json', nameZh: '且末玉都机场',
    set: { icao: 'ZWCM', iata: 'IQM', lat: 38.234516, lng: 85.465462, elevM: ft2m(4108) },
    expect: { icao: 'ZWQM', iata: 'QMX' },
  },
  {
    file: 'data-cn-3.json', nameZh: '若羌楼兰机场',
    set: { icao: 'ZWRQ', iata: 'RQA', lat: 38.974722, lng: 88.008333, elevM: ft2m(2916) },
    expect: { icao: undefined, iata: 'RZX' },
  },
  {
    file: 'data-global-2.json', nameZh: '比什凯克玛纳斯国际机场',
    set: { icao: 'UCFM', iata: 'BSZ', lat: 43.061298, lng: 74.4776, elevM: ft2m(2058) },
    expect: { icao: 'UAFM', iata: 'FRU' },
  },
]

const ROOT = __dirname
let applied = 0
for (const e of EDITS) {
  const p = path.join(ROOT, '..', e.file)
  const arr = JSON.parse(fs.readFileSync(p, 'utf8'))
  const r = arr.find((x) => x.nameZh === e.nameZh)
  if (!r) throw new Error(`找不到记录: ${e.nameZh}`)
  for (const [k, want] of Object.entries(e.expect)) {
    if ((r[k] || undefined) !== want) throw new Error(`${e.nameZh}: 旧值 ${k}=${r[k]} ≠ 预期 ${want ?? '（空）'}，已非原始状态，中止`)
  }
  Object.assign(r, e.set)
  fs.writeFileSync(p, JSON.stringify(arr, null, 2) + '\n')
  applied++
  console.log(`已裁定 ${e.nameZh}: ${JSON.stringify(e.set)}`)
}
console.log(`共 ${applied}/5 条改写（三沙永兴按结论保留不改）`)
