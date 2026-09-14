import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Airport } from '../src/utils/airportSearch'

/** 内存版 storage(mock uni.*Storage),支持按 key 注入写入失败 */
const m = vi.hoisted(() => {
  const store = new Map<string, unknown>()
  const failKeys = new Set<string>()
  return {
    store,
    failKeys,
    getItem: <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    setItem: (key: string, value: unknown) => {
      if (failKeys.has(key)) return false
      store.set(key, value)
      return true
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
  }
})

vi.mock('../src/utils/storage', () => ({ getItem: m.getItem, setItem: m.setItem, removeItem: m.removeItem }))
vi.mock('../src/static/airports.json', () => ({
  default: [
    {
      iata: 'PEK', icao: 'ZBAA', nameZh: '北京首都国际机场', nameEn: 'Beijing Capital International Airport',
      cityZh: '北京', cityEn: 'Beijing', country: '中国', lat: 40.08, lng: 116.58, tz: 'Asia/Shanghai', elevM: 35,
    },
  ],
}))
vi.mock('../src/dbversion.json', () => ({
  default: {
    version: '2026.9.1', count: 1, updatedAt: '2026-09-13 16:12',
    source: '测试来源', dataAsOf: '2026-09-13', completeness: { iata: 100 },
  },
}))

import { loadDb, saveDb, currentInfo, currentVersion, clearLocalDb } from '../src/utils/db'

const CHUNK = 400
const makeAirports = (n: number): Airport[] =>
  Array.from({ length: n }, (_, i) => ({
    iata: `A${i % 100}`.padStart(3, '0'),
    icao: `Z${String(i).padStart(4, '0')}`,
    nameZh: `测试机场${i}`,
    nameEn: `Test Airport ${i}`,
    cityZh: '测试市',
    cityEn: 'Test City',
    country: '中国',
    lat: 30 + (i % 10),
    lng: 100 + (i % 10),
    tz: 'Asia/Shanghai',
  }))

beforeEach(() => {
  m.store.clear()
  m.failKeys.clear()
  clearLocalDb()
})

describe('saveDb 原子写入（P0-3）', () => {
  it('成功后 meta 写入且分块带版本号，loadDb/currentInfo 生效', () => {
    const data = makeAirports(901) // 901/400 → 3 块
    expect(saveDb(data, '2026.10.1', '2026-10-01 10:00', { source: 's', dataAsOf: '2026-10-01' })).toBe(true)
    expect(currentVersion()).toBe('2026.10.1')
    expect(currentInfo().fromRemote).toBe(true)
    expect(currentInfo().count).toBe(901)
    expect(loadDb()).toHaveLength(901)
    expect(m.store.has(`at:db:chunk:2026.10.1:0`)).toBe(true)
    expect(m.store.has(`at:db:chunk:2026.10.1:2`)).toBe(true)
  })

  it('写入中途失败：旧在线库完好可用（而非回退内置），失败版本的键已回滚', () => {
    const old = makeAirports(901)
    expect(saveDb(old, '2026.10.1', '2026-10-01 10:00')).toBe(true)

    m.failKeys.add('at:db:chunk:2026.11.1:1') // 500 条 → 2 块，注入第 2 块写入失败
    expect(saveDb(makeAirports(500), '2026.11.1', '2026-11-01 10:00')).toBe(false)

    // 旧 meta 未被触碰，loadDb 仍返回旧在线库
    expect(currentVersion()).toBe('2026.10.1')
    expect(currentInfo().fromRemote).toBe(true)
    expect(loadDb()).toHaveLength(901)
    // 失败版本写入的分块已清理，无半成品残留
    expect([...m.store.keys()].filter((k) => k.includes('2026.11.1'))).toEqual([])
  })

  it('meta 写入失败同样回滚新分块并保留旧库', () => {
    const old = makeAirports(901)
    expect(saveDb(old, '2026.10.1', '2026-10-01 10:00')).toBe(true)
    m.failKeys.add('at:db:meta')
    expect(saveDb(makeAirports(201), '2026.12.1', '2026-12-01 10:00')).toBe(false)
    expect(currentVersion()).toBe('2026.10.1')
    expect(loadDb()).toHaveLength(901)
    expect([...m.store.keys()].filter((k) => k.includes('2026.12.1'))).toEqual([])
  })

  it('新库分块数变少：旧版本多余分块被清理，不会混入结果', () => {
    expect(saveDb(makeAirports(901), '2026.10.1', '2026-10-01 10:00')).toBe(true)
    expect(saveDb(makeAirports(201), '2026.12.1', '2026-12-01 10:00')).toBe(true)
    expect(m.store.has('at:db:chunk:2026.10.1:1')).toBe(false)
    expect(m.store.has('at:db:chunk:2026.10.1:2')).toBe(false)
    expect(loadDb()).toHaveLength(201)
  })

  it('v1 固定键旧库可读（迁移兼容），升级保存后 legacy 键被清理', () => {
    const legacy = makeAirports(2)
    m.store.set('at:db:chunk:0', legacy)
    m.store.set('at:db:meta', { version: '2026.9.9', count: 2, chunks: 1, updatedAt: '2026-09-20 09:00' })
    expect(currentVersion()).toBe('2026.9.9')
    expect(loadDb()).toHaveLength(2)

    expect(saveDb(makeAirports(901), '2027.1.1', '2027-01-01 10:00')).toBe(true)
    expect(m.store.has('at:db:chunk:0')).toBe(false) // legacy 键清理
    expect(loadDb()).toHaveLength(901)
  })

  it('clearLocalDb 清掉在线库回退内置', () => {
    expect(saveDb(makeAirports(901), '2026.10.1', '2026-10-01 10:00')).toBe(true)
    clearLocalDb()
    expect(currentVersion()).toBe('2026.9.1')
    expect(currentInfo().fromRemote).toBe(false)
    expect(loadDb()).toHaveLength(1)
  })

  it('currentInfo 透传数据来源/资料截至/完整率', () => {
    expect(currentInfo().source).toBe('测试来源')
    expect(currentInfo().dataAsOf).toBe('2026-09-13')
    expect(saveDb(makeAirports(10), '2026.10.1', '2026-10-01 10:00', {
      source: '新来源', dataAsOf: '2026-10-01', completeness: { iata: 99 },
    })).toBe(true)
    const info = currentInfo()
    expect(info.source).toBe('新来源')
    expect(info.dataAsOf).toBe('2026-10-01')
    expect(info.completeness).toEqual({ iata: 99 })
  })
})
