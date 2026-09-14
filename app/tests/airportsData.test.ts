import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Airport } from '../src/utils/airportSearch'

// 数据契约测试：内置机场数据库必须通过与 build.js 相同的完整性校验
const airports: Airport[] = JSON.parse(
  readFileSync(resolve(__dirname, '../src/static/airports.json'), 'utf8')
)
const dbVersion = JSON.parse(
  readFileSync(resolve(__dirname, '../src/dbversion.json'), 'utf8')
) as {
  version: string
  count: number
  updatedAt: string
  source: string
  dataAsOf: string
  completeness: Record<string, number>
}

describe('内置机场数据库', () => {
  it('数量与版本清单一致', () => {
    expect(airports.length).toBe(dbVersion.count)
    expect(dbVersion.version).toMatch(/^\d{4}\.\d{1,2}\.\d{1,2}$/)
  })
  it('总量与中国机场数量达标', () => {
    expect(airports.length).toBeGreaterThanOrEqual(500)
    const cn = airports.filter((a) => a.country === '中国')
    expect(cn.length).toBeGreaterThanOrEqual(240)
  })
  it('必填字段齐全', () => {
    for (const a of airports) {
      for (const k of ['nameZh', 'nameEn', 'cityZh', 'country', 'tz'] as const) {
        expect(typeof a[k] === 'string' && a[k].trim().length > 0).toBe(true)
      }
      expect(a.iata || a.icao).toBeTruthy()
    }
  })
  it('IATA / ICAO 全局唯一且格式合法', () => {
    const iata = new Set<string>()
    const icao = new Set<string>()
    for (const a of airports) {
      if (a.iata) {
        expect(a.iata).toMatch(/^[A-Z]{3}$/)
        expect(iata.has(a.iata)).toBe(false)
        iata.add(a.iata)
      }
      if (a.icao) {
        expect(a.icao).toMatch(/^[A-Z]{4}$/)
        expect(icao.has(a.icao)).toBe(false)
        icao.add(a.icao)
      }
    }
  })
  it('坐标在合法范围内', () => {
    for (const a of airports) {
      expect(a.lat).toBeGreaterThanOrEqual(-90)
      expect(a.lat).toBeLessThanOrEqual(90)
      expect(a.lng).toBeGreaterThanOrEqual(-180)
      expect(a.lng).toBeLessThanOrEqual(180)
    }
  })
})

describe('数据溯源与完整率契约（P0-2）', () => {
  it('版本信息包含来源署名与资料截至日期', () => {
    expect(dbVersion.source.trim().length).toBeGreaterThan(0)
    expect(dbVersion.source).toContain('airportsdata')
    expect(dbVersion.source).toContain('ourairports-data')
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
