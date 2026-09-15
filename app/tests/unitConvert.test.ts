import { describe, it, expect } from 'vitest'
import { convert, CATEGORIES, type CategoryId } from '../src/utils/unitConvert'

// v1.1.0 离线单位换算（迭代计划 §5）：
// 六类固定关系、双向即时、除温度外拒绝负数、空值/未完成小数/无效值不产生结果、
// 显示精度按 §5.3、往返误差在规定精度内。

const ids: CategoryId[] = ['length', 'distance', 'speed', 'pressure', 'mass', 'temperature']

describe('CATEGORIES 定义', () => {
  it('恰好六类且顺序与计划一致', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(ids)
  })
  it('各类单位标签', () => {
    const byId = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))
    expect(byId.length.left).toBe('ft')
    expect(byId.length.right).toBe('m')
    expect(byId.distance.left).toBe('NM')
    expect(byId.distance.right).toBe('km')
    expect(byId.speed.left).toBe('kt')
    expect(byId.speed.right).toBe('km/h')
    expect(byId.pressure.left).toBe('inHg')
    expect(byId.pressure.right).toBe('hPa')
    expect(byId.mass.left).toBe('lb')
    expect(byId.mass.right).toBe('kg')
    expect(byId.temperature.left).toBe('°C')
    expect(byId.temperature.right).toBe('°F')
  })
  it('各类单位中文名非空', () => {
    for (const c of CATEGORIES) {
      expect(c.leftZh.trim().length, `${c.id}.leftZh`).toBeGreaterThan(0)
      expect(c.rightZh.trim().length, `${c.id}.rightZh`).toBeGreaterThan(0)
    }
  })
})

describe('六类正向换算', () => {
  it('长度 1 ft = 0.3048 m', () => {
    expect(convert('length', '1', 'forward')).toBe('0.30')
    expect(convert('length', '100', 'forward')).toBe('30.48')
  })
  it('航程 1 NM = 1.852 km', () => {
    expect(convert('distance', '1', 'forward')).toBe('1.852')
    expect(convert('distance', '100', 'forward')).toBe('185.200')
  })
  it('速度 1 kt = 1.852 km/h', () => {
    expect(convert('speed', '1', 'forward')).toBe('1.852')
    expect(convert('speed', '250', 'forward')).toBe('463.000')
  })
  it('气压 1 inHg = 33.8638866667 hPa（显示 1 位小数）', () => {
    expect(convert('pressure', '1', 'forward')).toBe('33.9')
    expect(convert('pressure', '29.92', 'forward')).toBe('1013.2')
  })
  it('质量 1 lb = 0.45359237 kg', () => {
    expect(convert('mass', '1', 'forward')).toBe('0.45')
    expect(convert('mass', '2', 'forward')).toBe('0.91')
  })
  it('温度 °F = °C × 9/5 + 32', () => {
    expect(convert('temperature', '0', 'forward')).toBe('32.0')
    expect(convert('temperature', '37', 'forward')).toBe('98.6')
    expect(convert('temperature', '100', 'forward')).toBe('212.0')
    expect(convert('temperature', '36.6', 'forward')).toBe('97.9')
  })
})

describe('六类反向换算', () => {
  it('长度 m → ft', () => {
    expect(convert('length', '0.3048', 'reverse')).toBe('1.00')
    expect(convert('length', '30', 'reverse')).toBe('98.43')
  })
  it('航程 km → NM', () => {
    expect(convert('distance', '1.852', 'reverse')).toBe('1.000')
    expect(convert('distance', '100', 'reverse')).toBe('53.996')
  })
  it('速度 km/h → kt', () => {
    expect(convert('speed', '463', 'reverse')).toBe('250.000')
  })
  it('气压 hPa → inHg（显示 2 位小数）', () => {
    expect(convert('pressure', '1013.25', 'reverse')).toBe('29.92')
    expect(convert('pressure', '1', 'reverse')).toBe('0.03')
  })
  it('质量 kg → lb', () => {
    expect(convert('mass', '1', 'reverse')).toBe('2.20')
    expect(convert('mass', '100', 'reverse')).toBe('220.46')
  })
  it('温度 °C = (°F − 32) × 5/9', () => {
    expect(convert('temperature', '32', 'reverse')).toBe('0.0')
    expect(convert('temperature', '212', 'reverse')).toBe('100.0')
    expect(convert('temperature', '98.6', 'reverse')).toBe('37.0')
  })
})

describe('零值处理', () => {
  it('五类非温度 0 → 精度格式的 0', () => {
    expect(convert('length', '0', 'forward')).toBe('0.00')
    expect(convert('distance', '0', 'reverse')).toBe('0.000')
    expect(convert('speed', '0', 'forward')).toBe('0.000')
    expect(convert('pressure', '0', 'forward')).toBe('0.0')
    expect(convert('mass', '0', 'reverse')).toBe('0.00')
  })
  it('温度 0°C → 32.0°F；0°F → -17.8°C', () => {
    expect(convert('temperature', '0', 'forward')).toBe('32.0')
    expect(convert('temperature', '0', 'reverse')).toBe('-17.8')
  })
})

describe('负温度与负数拒绝', () => {
  it('温度允许负数', () => {
    expect(convert('temperature', '-40', 'forward')).toBe('-40.0')
    expect(convert('temperature', '-40', 'reverse')).toBe('-40.0')
    expect(convert('temperature', '-5', 'forward')).toBe('23.0')
    expect(convert('temperature', '14', 'reverse')).toBe('-10.0')
  })
  it('非温度负数拒绝（六类中其余五类双向均拒绝）', () => {
    for (const id of ids.filter((c) => c !== 'temperature')) {
      expect(convert(id, '-5', 'forward')).toBeNull()
      expect(convert(id, '-0.1', 'reverse')).toBeNull()
    }
  })
})

describe('空值、未完成小数和无效输入不产生结果', () => {
  it('空值', () => {
    for (const id of ids) {
      expect(convert(id, '', 'forward')).toBeNull()
      expect(convert(id, '   ', 'reverse')).toBeNull()
    }
  })
  it('未完成小数', () => {
    for (const id of ids) {
      expect(convert(id, '12.', 'forward')).toBeNull()
      expect(convert(id, '.', 'reverse')).toBeNull()
    }
  })
  it('无效输入', () => {
    for (const id of ids) {
      expect(convert(id, 'abc', 'forward')).toBeNull()
      expect(convert(id, '1e3', 'reverse')).toBeNull()
      expect(convert(id, '1,000', 'forward')).toBeNull()
      expect(convert(id, '--5', 'reverse')).toBeNull()
      expect(convert(id, '5kg', 'forward')).toBeNull()
      expect(convert(id, '.5', 'reverse')).toBeNull()
      expect(convert(id, '+5', 'forward')).toBeNull()
    }
  })
})

describe('显示精度（§5.3）', () => {
  it('ft/m 与 lb/kg 最多 2 位小数', () => {
    expect(convert('length', '123.456', 'forward')).toBe('37.63')
    expect(convert('mass', '3.14159', 'forward')).toBe('1.43')
  })
  it('NM/km 与 kt/km·h 最多 3 位小数', () => {
    expect(convert('distance', '12.3456', 'forward')).toBe('22.864')
    expect(convert('speed', '99.9999', 'forward')).toBe('185.200')
  })
  it('hPa 1 位、inHg 2 位', () => {
    expect(convert('pressure', '10', 'forward')).toBe('338.6')
    expect(convert('pressure', '338.6', 'reverse')).toBe('10.00')
  })
  it('温度 1 位', () => {
    expect(convert('temperature', '25.55', 'forward')).toBe('78.0')
  })
  it('舍入不产生负零', () => {
    expect(convert('temperature', '-17.8', 'forward')).toBe('0.0')
  })
})

describe('往返误差在规定精度内', () => {
  // F = 右单位/左单位换算因子；误差界 = 末位半单位 + 中间显示舍入经因子放大后的半单位
  const cases: Array<{ id: CategoryId; raw: string; F: number }> = [
    { id: 'length', raw: '123.45', F: 0.3048 },
    { id: 'distance', raw: '42', F: 1.852 },
    { id: 'speed', raw: '250.5', F: 1.852 },
    { id: 'pressure', raw: '29.92', F: 33.8638866667 },
    { id: 'mass', raw: '75.5', F: 0.45359237 },
    { id: 'temperature', raw: '23.4', F: 1.8 },
    { id: 'temperature', raw: '-10', F: 1.8 },
  ]
  const cat = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!

  it('正向再反向回到原值（误差 ≤ 显示精度界，左侧单位）', () => {
    for (const { id, raw, F } of cases) {
      const c = cat(id)
      const fwd = convert(id, raw, 'forward')
      expect(fwd, `${id} 正向应有结果`).not.toBeNull()
      const back = convert(id, fwd as string, 'reverse')
      expect(back, `${id} 反向应有结果`).not.toBeNull()
      const bound = 0.5 * Math.pow(10, -c.precisionLeft) + 0.5 * (Math.pow(10, -c.precisionRight) * 1) / F + 1e-9
      const err = Math.abs(Number(back) - Number(raw))
      expect(err, `${id} ${raw} → ${fwd} → ${back}`).toBeLessThanOrEqual(bound)
    }
  })
  it('反向再正向回到原值（误差 ≤ 显示精度界，右侧单位）', () => {
    for (const { id, raw, F } of cases) {
      const c = cat(id)
      const rev = convert(id, raw, 'reverse')
      expect(rev, `${id} 反向应有结果`).not.toBeNull()
      const back = convert(id, rev as string, 'forward')
      expect(back, `${id} 正向应有结果`).not.toBeNull()
      const bound = 0.5 * Math.pow(10, -c.precisionRight) + 0.5 * Math.pow(10, -c.precisionLeft) * F + 1e-9
      const err = Math.abs(Number(back) - Number(raw))
      expect(err, `${id} ${raw} → ${rev} → ${back}`).toBeLessThanOrEqual(bound)
    }
  })
})

describe('无状态：不得复用或误显示上一次结果', () => {
  it('有效计算后接无效输入返回 null，而非上次结果', () => {
    expect(convert('length', '10', 'forward')).toBe('3.05')
    expect(convert('length', 'abc', 'forward')).toBeNull()
    expect(convert('length', '', 'forward')).toBeNull()
  })
  it('同一输入重复计算结果稳定（纯函数）', () => {
    expect(convert('pressure', '29.92', 'forward')).toBe('1013.2')
    expect(convert('pressure', '29.92', 'forward')).toBe('1013.2')
  })
  it('切换类别后同输入互不干扰', () => {
    expect(convert('distance', '10', 'forward')).toBe('18.520')
    expect(convert('speed', '10', 'forward')).toBe('18.520')
    expect(convert('length', '10', 'forward')).toBe('3.05')
  })
})
