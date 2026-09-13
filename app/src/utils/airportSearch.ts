/**
 * 机场搜索核心（纯函数，禁止依赖 uni API，便于单测）
 *
 * 查询方向（问卷 Q13/Q14/Q15/Q16）：代码 → 机场 为主，同时支持
 * 中文机场名、中文城市名；输入即匹配；IATA 与 ICAO 同权重。
 */

export interface Airport {
  iata: string
  icao: string
  nameZh: string
  nameEn: string
  cityZh: string
  cityEn: string
  country: string
  lat: number
  lng: number
  tz: string
  elevM?: number
}

/** 相关度分值：越小越靠前 */
const SCORE = {
  IATA_EXACT: 0,
  IATA_PREFIX: 1,
  ICAO_PREFIX: 2,
  IATA_INCLUDES: 3,
  ICAO_INCLUDES: 4,
  NAME_ZH: 5,
  CITY_ZH: 6,
} as const

/**
 * 实时匹配：IATA/ICAO（不区分大小写，前缀优先于包含），
 * 中文机场名/城市名（包含匹配）。按相关度排序，超出 limit 截断。
 */
export function searchAirports(list: Airport[], query: string, limit = 50): Airport[] {
  const trimmed = query.trim()
  if (!trimmed) return []
  const qLower = trimmed.toLowerCase()

  const scored: { a: Airport; s: number; i: number }[] = []
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const iata = a.iata.toLowerCase()
    const icao = a.icao.toLowerCase()
    let s = Number.POSITIVE_INFINITY
    if (iata && iata === qLower) s = SCORE.IATA_EXACT
    else if (iata && iata.startsWith(qLower)) s = SCORE.IATA_PREFIX
    else if (icao && icao.startsWith(qLower)) s = SCORE.ICAO_PREFIX
    else if (iata && iata.includes(qLower)) s = SCORE.IATA_INCLUDES
    else if (icao && icao.includes(qLower)) s = SCORE.ICAO_INCLUDES
    else if (a.nameZh.includes(trimmed)) s = SCORE.NAME_ZH
    else if (a.cityZh.includes(trimmed)) s = SCORE.CITY_ZH
    if (s !== Number.POSITIVE_INFINITY) scored.push({ a, s, i })
  }
  scored.sort((x, y) => x.s - y.s || x.i - y.i)
  return scored.slice(0, limit).map((x) => x.a)
}
