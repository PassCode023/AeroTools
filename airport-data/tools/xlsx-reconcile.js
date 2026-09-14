#!/usr/bin/env node
/**
 * 本地对账工具（离线）：官方《2025年吞吐量排名.xlsx》（城市/短名）与
 * 名录登记表 260 条、内置库内地 237 条三方对齐。
 * 目的：恢复名录第 9 页真实条目；识别登记表中的陈旧条目；产出权威 270 清单。
 */
const fs = require('fs')
const path = require('path')

const RAW = path.join(__dirname, '..', 'raw', '_xlsx', 'xl', 'sharedStrings.xml')
const ss = fs.readFileSync(RAW, 'utf8')
const strings = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
)
const ranking = strings.filter((s) => /^[^\/\s]+\/[^\/\s]+$/.test(s))
console.log(`官方排名表机场条目：${ranking.length} 个`)
const shorts = ranking.map((r) => r.split('/')[1])
const dupShort = shorts.filter((s, i) => shorts.indexOf(s) !== i)
if (dupShort.length) console.log('短名重复:', dupShort)

const reg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'caac-registry.json'), 'utf8'))
const regNames = reg.pages.flatMap((p) => p.entries.map((e) => e.name))
const airports = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'app', 'src', 'static', 'airports.json'), 'utf8')
)
const isHMT = (a) => a.icao && /^(VH|VM|R)/.test(a.icao)
const mainland = airports.filter((a) => a.country === '中国' && !isHMT(a))

const inReg = []
const inOursOnly = []
const nowhere = []
for (const r of ranking) {
  const [city, short] = r.split('/')
  const regHit = regNames.find((n) => n.includes(short))
  if (regHit) { inReg.push(r); continue }
  const ourHit = mainland.find((a) => a.nameZh.includes(short))
  if (ourHit) { inOursOnly.push(`${r} → 我方记录「${ourHit.nameZh}」(${ourHit.iata || '---'}/${ourHit.icao || '----'})`); continue }
  nowhere.push(r)
}

console.log(`\n匹配到名录 260 条：${inReg.length} 个`)
console.log(`\n不在名录 260 条、但在我方库内（名录第 9 页候选）：${inOursOnly.length} 个`)
inOursOnly.forEach((s) => console.log('  ' + s))
console.log(`\n名录与我方均无（若非短名歧义，即名录 260 中的陈旧条目对应的真身/新机场）：${nowhere.length} 个`)
nowhere.forEach((s) => console.log('  ' + s))

// 名录 260 中不在官方排名表内的条目（按短名包含匹配）
const stale = []
for (const n of regNames) {
  // 取名称去掉"机场"后缀，用后半段（专有名）在 shorts 里找
  const core = n.replace(/(国际)?机场$/, '')
  const tail = core.length > 2 ? core.slice(-3) : core
  if (!shorts.some((s) => core.includes(s) || s.includes(core) || s.includes(tail) || tail.includes(s))) {
    stale.push(n)
  }
}
console.log(`\n名录 260 条中未匹配到排名表的（疑似陈旧/短名歧义）：${stale.length} 个`)
stale.forEach((s) => console.log('  ' + s))
