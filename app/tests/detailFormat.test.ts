import { describe, it, expect } from 'vitest'
import { coordDegMin, elevDual, elevFt } from '../src/utils/detailFormat'

// v1.1.1 机场详情增强（迭代计划 §6.4）：
// 坐标同时显示十进制度与航空度分格式；海拔同时显示 m / ft。

describe('coordDegMin（度分格式，§6.4）', () => {
  it('东经：116.596702 → 116°35.8′ E', () => {
    expect(coordDegMin(116.596702, false)).toBe('116°35.8′ E')
  })
  it('北纬：40.077349 → 40°04.6′ N', () => {
    expect(coordDegMin(40.077349, true)).toBe('40°04.6′ N')
  })
  it('西经：-118.4081 → 118°24.5′ W', () => {
    expect(coordDegMin(-118.4081, false)).toBe('118°24.5′ W')
  })
  it('进位：59.9999999 → 60°00.0′ N（分满 60 进一度）', () => {
    expect(coordDegMin(59.9999999, true)).toBe('60°00.0′ N')
  })
  it('零点：0 → 0°00.0′ N', () => {
    expect(coordDegMin(0, true)).toBe('0°00.0′ N')
  })
  it('南纬：-33.9467 → 33°56.8′ S', () => {
    expect(coordDegMin(-33.9467, true)).toBe('33°56.8′ S')
  })
})

describe('elevDual（海拔双单位，§6.4）', () => {
  it('35 米 → 115 英尺', () => {
    expect(elevDual(35)).toBe('35 米 / 115 英尺')
  })
  it('真实 0（海平面）原样显示，不当作缺失', () => {
    expect(elevDual(0)).toBe('0 米 / 0 英尺')
  })
  it('4374 米（拉萨）→ 14350 英尺', () => {
    expect(elevDual(4374)).toBe('4374 米 / 14350 英尺')
  })
  it('负海拔（阿姆斯特丹 -4 米）双向显示', () => {
    expect(elevDual(-4)).toBe('-4 米 / -13 英尺')
  })
  it('elevFt 因子：1 m = 1/0.3048 ft', () => {
    expect(elevFt(0.3048)).toBe(1)
    expect(elevFt(30.48)).toBe(100)
  })
})
