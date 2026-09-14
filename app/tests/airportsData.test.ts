import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Airport } from '../src/utils/airportSearch'

// 数据契约测试：内置机场数据库必须与数据清单（dbversion.json）的契约一致
const airports: Airport[] = JSON.parse(
  readFileSync(resolve(__dirname, '../src/static/airports.json'), 'utf8')
)
const dbVersion = JSON.parse(
  readFileSync(resolve(__dirname, '../src/dbversion.json'), 'utf8')
) as {
  version: string
  count: number
  updatedAt: string
  sources: Array<{ name: string; url: string; license: string; usage: string }>
  dataAsOf: string
  verifiedAt: string
  coverage: { expected: number; matched: number; asOf: string }
  completeness: Record<string, number>
}

describe('内置机场数据库', () => {
  it('数量与版本清单一致', () => {
    expect(airports.length).toBe(dbVersion.count)
    expect(dbVersion.version).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}$/)
  })
  it('覆盖门禁：境内运输机场 270/270（截至 2025-12-31）', () => {
    expect(dbVersion.coverage.expected).toBe(270)
    expect(dbVersion.coverage.matched).toBe(270)
    expect(dbVersion.coverage.asOf).toBe('2025-12-31')
  })
  it('数据清单包含人工核验日期 verifiedAt', () => {
    expect(dbVersion.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('来源为结构化 sources，含三个来源及许可与用途', () => {
    expect(Array.isArray(dbVersion.sources)).toBe(true)
    const names = dbVersion.sources.map((s) => s.name)
    expect(names).toContain('airportsdata')
    expect(names).toContain('ourairports-data')
    expect(names).toContain('caac')
    for (const s of dbVersion.sources) {
      expect(s.url).toMatch(/^https:\/\//)
      expect(s.license.trim().length).toBeGreaterThan(0)
      expect(s.usage.trim().length).toBeGreaterThan(0)
    }
  })
  it('数据契约：仅中文名与国家必填', () => {
    for (const a of airports) {
      expect(typeof a.nameZh === 'string' && a.nameZh.trim().length > 0).toBe(true)
      expect(typeof a.country === 'string' && a.country.trim().length > 0).toBe(true)
    }
  })
  it('可选字段存在时必须合法（代码格式/坐标范围/类型）', () => {
    for (const a of airports as unknown as Record<string, unknown>[]) {
      if (a.iata !== undefined) expect(a.iata).toMatch(/^[A-Z]{3}$/)
      if (a.icao !== undefined) expect(a.icao).toMatch(/^[A-Z]{4}$/)
      if (a.lat !== undefined) {
        expect(a.lat).toBeGreaterThanOrEqual(-90)
        expect(a.lat).toBeLessThanOrEqual(90)
      }
      if (a.lng !== undefined) {
        expect(a.lng).toBeGreaterThanOrEqual(-180)
        expect(a.lng).toBeLessThanOrEqual(180)
      }
      if (a.elevM !== undefined) expect(typeof a.elevM).toBe('number')
      if (a.aliases !== undefined) {
        expect(Array.isArray(a.aliases)).toBe(true)
        for (const x of a.aliases as unknown[]) expect(typeof x === 'string' && (x as string).length > 0).toBe(true)
      }
      for (const k of ['nameEn', 'cityEn', 'cityZh', 'tz']) {
        if (a[k] !== undefined) expect(typeof a[k]).toBe('string')
      }
    }
  })
  it('IATA / ICAO 存在时全局唯一', () => {
    const iata = new Set<string>()
    const icao = new Set<string>()
    for (const a of airports as unknown as Record<string, unknown>[]) {
      if (a.iata) {
        expect(iata.has(a.iata as string)).toBe(false)
        iata.add(a.iata as string)
      }
      if (a.icao) {
        expect(icao.has(a.icao as string)).toBe(false)
        icao.add(a.icao as string)
      }
    }
  })
  it('中国记录中文名唯一（含通用库）', () => {
    const seen = new Set<string>()
    for (const a of airports) {
      if (a.country !== '中国') continue
      expect(seen.has(a.nameZh)).toBe(false)
      seen.add(a.nameZh)
    }
  })
  it('客户端数据不含内部核对字段 caacRef', () => {
    for (const a of airports as unknown as Record<string, unknown>[]) {
      expect('caacRef' in a).toBe(false)
    }
  })
  it('缺失字段以键缺省表达，不产生伪造零值', () => {
    const optional = ['iata', 'icao', 'nameEn', 'cityEn', 'lat', 'lng', 'elevM', 'tz']
    for (const a of airports as unknown as Record<string, unknown>[]) {
      for (const k of optional) {
        if (k in a) {
          const v = a[k]
          expect(v === null || v === undefined || v === '').toBe(false)
        }
      }
    }
  })
})

describe('数据溯源与完整率契约（P0-2）', () => {
  it('资料截至日期格式合法', () => {
    expect(dbVersion.dataAsOf).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('completeness 覆盖全部字段且与实际数据一致', () => {
    const fields = ['iata', 'icao', 'nameZh', 'nameEn', 'cityZh', 'cityEn', 'lat', 'lng', 'elevM', 'tz']
    expect(Object.keys(dbVersion.completeness).sort()).toEqual([...fields].sort())
    for (const f of fields) {
      const present = airports.filter(
        (a) => (a as unknown as Record<string, unknown>)[f] !== undefined &&
               (a as unknown as Record<string, unknown>)[f] !== null &&
               (a as unknown as Record<string, unknown>)[f] !== ''
      ).length
      expect(dbVersion.completeness[f]).toBe(Math.round((present / airports.length) * 100))
    }
  })
})
