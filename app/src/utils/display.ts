/**
 * 缺失值降级显示（v1.0.2 数据可信整改 §4.4）：
 * 缺失统一显示 —；真实 0（如海平面海拔）原样显示，禁止把缺失显示为 0/NaN。
 */
export function dash(value: string | number | null | undefined, digits?: number): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    return digits === undefined ? String(value) : value.toFixed(digits)
  }
  return value
}
