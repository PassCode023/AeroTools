/**
 * 机场搜索核心（纯函数，禁止依赖 uni API，便于单测）
 *
 * v1.0.2：代码 → 机场为主，支持中文机场名/城市名，输入即匹配。
 * v1.1.1（§6.1–§6.3）：构建期拼音字段（py 全拼 / pj 首字母）、英文名/城市、
 * 曾用名进入搜索；查询归一化（大小写/全半角/空格/连字符/点号/拉丁重音）；
 * 排序按 §6.3 六级优先级，同分保持数据库原始顺序；默认最多 50 条。
 */
import { normalizeQuery } from './searchNormalize'

export interface Airport {
  iata?: string
  icao?: string
  nameZh: string
  nameEn?: string
  cityZh?: string
  cityEn?: string
  country: string
  lat?: number
  lng?: number
  tz?: string
  elevM?: number
  /** 曾用名（v1.0.2 起，民航局名录确认更名后的旧名） */
  aliases?: string[]
  /** 构建期全拼（段间 | 分隔：机场名/城市/曾用名），v1.1.1 */
  py?: string
  /** 构建期拼音首字母（段间 | 分隔，同上），v1.1.1 */
  pj?: string
}

/** 相关度层级（§6.3）：数值越小越靠前 */
const TIER = {
  CODE_EXACT: 1,
  CODE_PREFIX: 2,
  TEXT_EXACT: 3,
  TEXT_PREFIX: 4,
  INCLUDES: 5,
} as const

const Infinity_ = Number.POSITIVE_INFINITY

/**
 * 实时匹配并按 §6.3 排序；超出 limit 截断（默认 50）。
 * 归一化对代码、中文名、英文、曾用名与拼音段一致生效。
 */
export function searchAirports(list: Airport[], query: string, limit = 50): Airport[] {
  const q = normalizeQuery(query)
  if (!q) return []

  const scored: { a: Airport; tier: number; i: number }[] = []
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const codes: string[] = []
    if (a.iata) codes.push(a.iata.toLowerCase())
    if (a.icao) codes.push(a.icao.toLowerCase())

    const texts: string[] = []
    const push = (v?: string) => {
      if (v) texts.push(normalizeQuery(v))
    }
    push(a.nameZh)
    push(a.cityZh)
    push(a.nameEn)
    push(a.cityEn)
    if (a.aliases) for (const alias of a.aliases) push(alias)

    // py/pj 由构建期生成（小写、无分隔符），本身即归一化形态
    const pySegs: string[] = []
    if (a.py) for (const seg of a.py.split('|')) pySegs.push(seg)
    if (a.pj) for (const seg of a.pj.split('|')) pySegs.push(seg)

    let tier: number = Infinity_
    if (codes.some((c) => c === q)) tier = TIER.CODE_EXACT
    else if (codes.some((c) => c.startsWith(q))) tier = TIER.CODE_PREFIX
    else if (texts.some((t) => t === q) || pySegs.some((t) => t === q)) tier = TIER.TEXT_EXACT
    else if (texts.some((t) => t.startsWith(q)) || pySegs.some((t) => t.startsWith(q)))
      tier = TIER.TEXT_PREFIX
    else if (
      codes.some((c) => c.includes(q)) ||
      texts.some((t) => t.includes(q)) ||
      pySegs.some((t) => t.includes(q))
    )
      tier = TIER.INCLUDES

    if (tier !== Infinity_) scored.push({ a, tier, i })
  }
  scored.sort((x, y) => x.tier - y.tier || x.i - y.i)
  return scored.slice(0, limit).map((x) => x.a)
}
