#!/usr/bin/env node
/**
 * 本地对账工具（离线，不访问网络）：
 *   民航局名录登记表 caac-registry.json  vs  内置机场库 app/src/static/airports.json
 * 输出：
 *   1. 登记表自身完整性（页数/条数/唯一性）
 *   2. 库内内地机场 nameZh 不在名录中（候选：第 9 页真实条目、我方旧名）
 *   3. 名录条目不在库内内地机场中（候选：待补齐机场、官方新名）
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'caac-registry.json'), 'utf8'))
const airports = JSON.parse(
  fs.readFileSync(path.join(ROOT, '..', 'app', 'src', 'static', 'airports.json'), 'utf8')
)

// 1. 登记表完整性
const names = []
const perPage = []
for (const p of reg.pages) {
  perPage.push(`${p.page}:${p.entries.length}`)
  names.push(...p.entries.map((e) => e.name))
}
const unique = new Set(names)
console.log(`登记表：${reg.pages.length} 页 [${perPage.join(' ')}]`)
console.log(`条目总数 ${names.length}，去重后 ${unique.size}`)
if (names.length !== unique.size) {
  const seen = new Set()
  for (const n of names) {
    if (seen.has(n)) console.log(`  重复: ${n}`)
    seen.add(n)
  }
}

// 2. 库内内地机场（排除港澳台：VH 香港 / VM 澳门 / R* 台湾）
const isHMT = (a) => a.icao && /^(VH|VM|R)/.test(a.icao)
const mainland = airports.filter((a) => a.country === '中国' && !isHMT(a))
console.log(`\n库内记录 ${airports.length} 条；country=中国 ${airports.filter((a) => a.country === '中国').length} 条；内地 ${mainland.length} 条`)

const oursNotInReg = mainland.filter((a) => !unique.has(a.nameZh))
const regNotInOurs = names.filter((n) => !mainland.some((a) => a.nameZh === n))

console.log(`\n[A] 库内内地机场不在名录（${oursNotInReg.length} 条）：`)
for (const a of oursNotInReg) console.log(`  ${a.nameZh} | ${a.iata || '---'} ${a.icao || '----'} | ${a.cityZh}`)

console.log(`\n[B] 名录条目不在库内（${regNotInOurs.length} 条）：`)
for (const n of regNotInOurs) console.log(`  ${n}`)

console.log(`\n[B] - [A] 差额 = ${regNotInOurs.length - oursNotInReg.length}（若第 9 页空缺为 10 条，此值应为 10）`)
