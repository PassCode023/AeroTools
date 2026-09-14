#!/usr/bin/env node
/**
 * v1.0.2 源数据迁移（一次性）：
 *   1. 33 起官方确认更名：nameZh 改为名录官方名，旧名追加进 aliases（曾用名）。
 *   2. 为与名录 270 名称精确匹配的记录补注 caacRef（p{页}e{条}）。
 *   3. 不在册机场不动：港澳台 10 条、停航的吉林二台子（JIL）留通用库、无 caacRef。
 * 幂等：重复执行不会重复追加 aliases 或改错名。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')

// 官方确认更名（旧名 → 名录现行官方名）；来源：名录登记表 270 与库内差集逐一对账
const RENAMES = [
  ['喀纳斯机场', '布尔津喀纳斯机场'],
  ['包头东河机场', '包头东河国际机场'],
  ['大同云冈机场', '大同云冈国际机场'],
  ['德令哈机场', '海西德令哈机场'],
  ['恩施许家坪机场', '恩施许家坪国际机场'],
  ['阜阳西关机场', '阜阳机场'],
  ['井冈山机场', '吉安井冈山机场'],
  ['济宁大安山机场', '济宁大安机场'],
  ['佳木斯东郊机场', '佳木斯松江国际机场'],
  ['锦州湾机场', '锦州锦州湾机场'],
  ['康定机场', '甘孜康定机场'],
  ['克拉玛依机场', '克拉玛依古海机场'],
  ['临沂启阳机场', '临沂启阳国际机场'],
  ['龙岩冠豸山机场', '连城冠豸山机场'],
  ['满洲里西郊国际机场', '满洲里西郊机场'],
  ['茫崖花土沟机场', '海西茫崖机场'],
  ['重庆黔江武陵山机场', '黔江武陵山机场'],
  ['庆阳西峰机场', '庆阳机场'],
  ['琼海博鳌机场', '琼海博鳌国际机场'],
  ['三沙永兴岛机场', '三沙永兴机场'],
  ['重庆万州五桥机场', '万州五桥机场'],
  ['潍坊南苑机场', '潍坊机场'],
  ['文山普者黑机场', '文山砚山机场'],
  ['乌鲁木齐地窝堡国际机场', '乌鲁木齐天山国际机场'],
  ['梧州长洲岛机场', '梧州西江机场'],
  ['盐城南阳机场', '盐城南洋国际机场'],
  ['那拉提机场', '新源那拉提机场'],
  ['伊宁机场', '伊犁伊宁国际机场'],
  ['昭通昭阳机场', '昭通机场'],
  ['舟山普陀山机场', '舟山普陀山国际机场'],
  ['呼伦贝尔海拉尔机场', '呼伦贝尔海拉尔国际机场'],
  ['运城张孝机场', '运城盐湖国际机场'],
  ['加格达奇嘎仙机场', '大兴安岭鄂伦春机场'],
]

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'caac-registry.json'), 'utf8'))
const nameToRef = new Map()
for (const p of registry.pages) {
  p.entries.forEach((e, i) => {
    const ref = `p${String(p.page).padStart(2, '0')}e${String(i + 1).padStart(2, '0')}`
    if (nameToRef.has(e.name)) throw new Error(`登记表名称重复: ${e.name}`)
    nameToRef.set(e.name, ref)
  })
}

const files = fs.readdirSync(ROOT).filter((f) => /^data-.*\.json$/.test(f)).sort()
let renamed = 0
const allNames = new Map()
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
  for (const r of arr) {
    const pair = RENAMES.find(([oldN]) => oldN === r.nameZh)
    if (pair) {
      r.aliases = Array.from(new Set([...(r.aliases || []), pair[0]]))
      r.nameZh = pair[1]
      renamed++
    }
    if (allNames.has(r.nameZh)) throw new Error(`更名后重名: ${r.nameZh}（${f} 与 ${allNames.get(r.nameZh)}）`)
    allNames.set(r.nameZh, f)
  }
  fs.writeFileSync(path.join(ROOT, f), JSON.stringify(arr, null, 2) + '\n')
}
console.log(`更名 ${renamed} 条（预期 33）`)
if (renamed !== 33) throw new Error('更名数不符，中止')

// caacRef 补注（含 data-cn-5.json 的新机场）
let refCount = 0
for (const f of files) {
  const arr = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))
  for (const r of arr) {
    const ref = nameToRef.get(r.nameZh)
    if (ref) {
      r.caacRef = ref
      refCount++
    } else {
      delete r.caacRef
    }
  }
  fs.writeFileSync(path.join(ROOT, f), JSON.stringify(arr, null, 2) + '\n')
}
console.log(`caacRef 补注 ${refCount} 条（预期 270）`)
if (refCount !== 270) {
  const missing = [...nameToRef.keys()].filter((n) => !allNames.has(n) || !nameToRef.has(n))
  const unmatched = [...nameToRef.entries()].filter(([n]) => {
    const ff = files.find((f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')).some((r) => r.nameZh === n))
    return !ff
  }).map(([n]) => n)
  throw new Error(`caacRef 数不符。名录名称无对应记录 ${unmatched.length} 个：${unmatched.join('、')}`)
}
console.log('迁移完成')
