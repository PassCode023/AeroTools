import { describe, it, expect } from 'vitest'
import { dash } from '../src/utils/display'

// 降级显示（v1.0.2 §4.4）：缺失字段统一显示 —，禁止把缺失显示为 0 或 NaN
describe('dash() 降级显示', () => {
  it('缺失值显示为 —', () => {
    expect(dash(undefined)).toBe('—')
    expect(dash(null)).toBe('—')
    expect(dash('')).toBe('—')
  })
  it('真实值原样显示（海拔 0 是真实值，不是缺失）', () => {
    expect(dash(0)).toBe('0')
    expect(dash(35)).toBe('35')
    expect(dash('Asia/Shanghai')).toBe('Asia/Shanghai')
  })
  it('数值可选小数位', () => {
    expect(dash(35.567, 2)).toBe('35.57')
    expect(dash(undefined, 2)).toBe('—')
  })
})
