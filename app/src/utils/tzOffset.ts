/**
 * 时区偏移查表（v1.1.1 §6.4，纯函数）：
 * 微信小程序 iOS 端 JSCore 的运行时 Intl 时区支持不完整，偏移改为查构建期生成的
 * 跳变表（airport-data/build.js 按天采样生成，见 app/src/static/tzoffsets.json）。
 * 表内偏移为"东经正"分钟数（UTC+8 → 480）；窗口外沿用端点值（显示用途可接受）。
 */
import zoneTable from '../static/tzoffsets.json'

interface ZoneEntry {
  /** 标准偏移（夏令时判定基准：当前偏移 ≠ 标准偏移即提示执行夏令时） */
  std: number
  /** 跳变表：[起始日 YYYYMMDD, 该日起的偏移分钟]，按起始日升序 */
  t: [number, number][]
}

interface ZoneTable {
  window: { from: number; to: number }
  zones: Record<string, ZoneEntry>
}

// JSON 导入的元组经 unknown 收窄（resolveJsonModule 推导为 number[]）
const zones = (zoneTable as unknown as ZoneTable).zones

/** 设备本地日期 → YYYYMMDD 数值（纯 Date 方法，不经 Intl） */
function localDayNum(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

/** 时区在指定日期的偏移（分钟，东经正）；未知/非法时区返回 null */
export function tzOffsetMinutes(tz: string | undefined, at: Date): number | null {
  if (!tz) return null
  const zone = zones[tz]
  if (!zone || !zone.t.length) return null
  const day = localDayNum(at)
  let offset = zone.t[0][1]
  for (const [from, off] of zone.t) {
    if (day >= from) offset = off
    else break
  }
  return offset
}

/** 偏移分钟 → "UTC±HH:MM" */
export function formatUtcOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `UTC${sign}${hh}:${mm}`
}

/** 是否正在执行夏令时（当前偏移 ≠ 标准偏移）；未知时区恒为否 */
export function isDstActive(tz: string | undefined, at: Date): boolean {
  if (!tz) return false
  const zone = zones[tz]
  if (!zone) return false
  const offset = tzOffsetMinutes(tz, at)
  return offset !== null && offset !== zone.std
}

/** 详情"时区"行文案：IANA（UTC±HH:MM）；缺失 —；不支持/非法 → 当前偏移不可用 */
export function tzDisplay(tz: string | undefined, at: Date): string {
  if (!tz) return '—'
  const offset = tzOffsetMinutes(tz, at)
  if (offset === null) return '当前偏移不可用'
  return `${tz}（${formatUtcOffset(offset)}）`
}
