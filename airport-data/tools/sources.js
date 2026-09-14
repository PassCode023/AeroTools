'use strict'
/**
 * 三源记录 → 规范化内部记录（含 __source 标识），字段对齐 arbitrate.js 的裁定矩阵。
 * 上游两 CSV 均为“人工下载发布方明确提供的单个文件”（计划 §3.2），原始文件不入库、
 * 以 registry.json 的 SHA-256 登记复现验证；CAAC 名录为人工逐页浏览核对后的事实记录
 * caac-audit.json，不含代码与坐标。
 * 缺字段保持 undefined，绝不伪造零值（计划 §3.1）。
 */
const FT_TO_M = 0.3048

const str = (v) => {
  const t = (v ?? '').toString().trim()
  return t === '' ? undefined : t
}
const num = (v) => {
  const t = (v ?? '').toString().trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
const icaoKey = (v) => {
  const t = str(v)
  return t && /^[A-Z]{4}$/.test(t) ? t : undefined
}
const meters = (ft) => {
  const n = num(ft)
  return n === undefined ? undefined : Math.round(n * FT_TO_M)
}

/** ourairports-data airports.csv 行 */
function fromOurAirports(rows) {
  return rows.map((r) => ({
    __source: 'ourairports',
    icao: icaoKey(r.icao_code) || icaoKey(r.ident),
    iata: str(r.iata_code),
    nameEn: str(r.name),
    cityEn: str(r.municipality),
    lat: num(r.latitude_deg),
    lng: num(r.longitude_deg),
    elevM: meters(r.elevation_ft),
    countryCode: str(r.iso_country),
    type: str(r.type),
  }))
}

/** airportsdata airports.csv 行（海拔为英尺；tz 为该源独有的 IANA 时区字段） */
function fromAirportsdata(rows) {
  return rows.map((r) => ({
    __source: 'airportsdata',
    icao: icaoKey(r.icao),
    iata: str(r.iata),
    nameEn: str(r.name),
    cityEn: str(r.city),
    lat: num(r.lat),
    lng: num(r.lon),
    elevM: meters(r.elevation),
    tz: str(r.tz),
    countryCode: str(r.country),
  }))
}

/** caac-audit.json（人工逐页核对记录）→ 官方事实条目 */
function fromCaacAudit(audit) {
  return audit.airports.map((a) => ({
    __source: 'caac',
    nameZh: str(a.name),
    province: str(a.province),
    region: str(a.region),
  }))
}

module.exports = { fromOurAirports, fromAirportsdata, fromCaacAudit }
