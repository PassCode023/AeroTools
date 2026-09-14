/**
 * 机场详情展示格式化（v1.1.1 §6.4，纯函数）：
 * 海拔同时显示 m / ft；坐标同时支持十进制度与航空度分格式（0.1′ 精度，分满 60 进位）。
 */

export const M_PER_FT = 0.3048

/** 米 → 英尺（整数舍入） */
export function elevFt(meters: number): number {
  return Math.round(meters / M_PER_FT)
}

/** 海拔双单位文本；调用方对缺失值先走 dash() 降级 */
export function elevDual(meters: number): string {
  return `${meters} 米 / ${elevFt(meters)} 英尺`
}

/**
 * 十进制度 → 航空度分格式（如 40°04.6′ N）。
 * 内部以 0.1 分为最小单位取整，天然处理 59.999…→60°00.0′ 的进位。
 */
export function coordDegMin(value: number, isLat: boolean): string {
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W'
  const totalTenthMin = Math.round(Math.abs(value) * 600)
  const deg = Math.floor(totalTenthMin / 600)
  const minTenth = totalTenthMin - deg * 600
  const minWhole = Math.floor(minTenth / 10)
  const minDec = minTenth % 10
  return `${deg}°${String(minWhole).padStart(2, '0')}.${minDec}′ ${hemi}`
}
