'use strict'
/**
 * 字段级冲突裁定矩阵与合并去重（来源优先级高 → 低；缺位来源自动跳过）。
 * 定位依据（详见 docs/数据源与更新SOP.md）：
 * - caac      民航局名录 = 境内运输机场的存在性/数量/官方中文名/省市归属的法源事实（仅人工核对，无代码无坐标）
 * - manual    已入库精选数据 = 人工整理基线（双语、country 中文名等，无该源字段时由人工兜底）
 * - ourairports  ICAO/坐标/海拔/英文名基线（日更、社区纠错、覆盖最全；airports.csv 无时区字段）
 * - airportsdata IATA 经 IATA 官方查询验证、独有 IANA 时区；自述海拔“经常是错的”，故海拔让位 ourairports
 * CAAC 现不发布代码；iata/icao 把 caac 排在最前是政策位——将来官方名录带码即自动生效。
 */
const FIELD_PRIORITY = {
  nameZh: ['caac', 'manual'],
  cityZh: ['manual', 'caac'],
  country: ['manual', 'caac'],
  province: ['caac'],
  region: ['caac'],
  iata: ['caac', 'airportsdata', 'ourairports'],
  icao: ['caac', 'ourairports', 'airportsdata'],
  nameEn: ['ourairports', 'airportsdata'],
  cityEn: ['ourairports', 'airportsdata'],
  lat: ['ourairports', 'airportsdata'],
  lng: ['ourairports', 'airportsdata'],
  elevM: ['ourairports', 'airportsdata'],
  tz: ['airportsdata', 'ourairports'],
}

const hasValue = (v) => {
  if (v === null || v === undefined) return false
  if (typeof v === 'number') return Number.isFinite(v)
  return typeof v === 'string' && v.trim() !== ''
}

/** 按矩阵裁定单字段：返回 {value, source}，无人提供合法值时返回 null。 */
function pickField(field, candidates) {
  const order = FIELD_PRIORITY[field]
  if (!order) return null
  for (const src of order) {
    const hit = candidates.find((c) => c.__source === src && hasValue(c[field]))
    if (hit) return { value: hit[field], source: src }
  }
  return null
}

/** 去重键：ICAO → IATA → 规范化(英文名|国家码/国家)。同一机场多源记录必须落同一键。 */
function dedupKey(record) {
  if (record.icao) return `icao:${record.icao}`
  if (record.iata) return `iata:${record.iata}`
  const name = (record.nameEn || '').trim().toLowerCase()
  const cc = record.countryCode || record.country || ''
  return `name:${name}|${cc}`.toLowerCase()
}

/**
 * 合并同一机场的多源记录：逐字段按矩阵取赢家，并输出逐字段出处 provenance。
 * 返回 [{key, record, provenance, sources}]。record 仅含矩阵内字段。
 *
 * CAAC 记录只有官方中文名（无代码无英文名），无法按代码/英文名分组；
 * 其联结键就是官方中文名精确匹配——并入 nameZh 相同的非 CAAC 组。
 */
function mergeAirportRecords(records) {
  const groups = new Map()
  for (const r of records) {
    const key = dedupKey(r)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(r)
  }
  const zhIndex = new Map()
  for (const [key, g] of groups) {
    const rec = g.find((r) => r.__source !== 'caac' && hasValue(r.nameZh))
    if (rec) zhIndex.set(rec.nameZh.trim(), key)
  }
  for (const [key, g] of [...groups]) {
    if (!g.every((r) => r.__source === 'caac')) continue
    const target = zhIndex.get((g[0].nameZh || '').trim())
    if (target && target !== key) {
      groups.get(target).push(...g)
      groups.delete(key)
    }
  }
  const out = []
  for (const [key, group] of groups) {
    const record = {}
    const provenance = {}
    for (const field of Object.keys(FIELD_PRIORITY)) {
      const picked = pickField(field, group)
      if (picked) {
        record[field] = picked.value
        provenance[field] = picked.source
      }
    }
    out.push({ key, record, provenance, sources: group.map((g) => g.__source) })
  }
  return out
}

module.exports = { FIELD_PRIORITY, hasValue, pickField, dedupKey, mergeAirportRecords }
