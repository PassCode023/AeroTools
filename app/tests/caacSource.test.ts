import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

// 民航局名录登记表与源数据 caacRef 门禁（v1.0.2 数据可信整改）
const dataDir = resolve(__dirname, '../../airport-data')
const registry = JSON.parse(
  readFileSync(resolve(dataDir, 'caac-registry.json'), 'utf8')
) as {
  source: { asOf: string; publisher: string; url: string }
  pages: Array<{ page: number; entries: Array<{ name: string }> }>
}
const sourceFiles = readdirSync(dataDir).filter((f) => /^data-.*\.json$/.test(f)).sort()
type SrcRecord = Record<string, unknown> & { __file?: string }
const records: SrcRecord[] = sourceFiles.flatMap((f) =>
  (
    JSON.parse(readFileSync(resolve(dataDir, f), 'utf8')) as Array<Record<string, unknown>>
  ).map((r): SrcRecord => ({ ...r, __file: f }))
)

const refRe = /^p(\d{2})e(\d{2})$/

describe('民航局名录登记表', () => {
  it('共 27 页、每页 10 条、合计 270 条且名称唯一', () => {
    expect(registry.pages).toHaveLength(27)
    const names: string[] = []
    for (const p of registry.pages) {
      expect(p.entries).toHaveLength(10)
      names.push(...p.entries.map((e) => e.name))
    }
    expect(names).toHaveLength(270)
    expect(new Set(names).size).toBe(270)
  })
  it('登记表口径截至 2025-12-31，发布方为民航局', () => {
    expect(registry.source.asOf).toBe('2025-12-31')
    expect(registry.source.publisher).toContain('民用航空局')
    expect(registry.source.url).toMatch(/^https:\/\/www\.caac\.gov\.cn\//)
  })
})

describe('源数据 caacRef 门禁', () => {
  const withRef = records.filter((r) => r.caacRef !== undefined)
  const regEntries = new Map<string, string>()
  for (const p of registry.pages) {
    p.entries.forEach((e, i) => regEntries.set(`p${String(p.page).padStart(2, '0')}e${String(i + 1).padStart(2, '0')}`, e.name))
  }

  it('caacRef 恰好 270 条', () => {
    expect(withRef.length).toBe(270)
  })
  it('caacRef 格式合法且指向登记表唯一条目', () => {
    const used = new Set<string>()
    for (const r of withRef) {
      const ref = r.caacRef as string
      expect(ref).toMatch(refRe)
      expect(used.has(ref)).toBe(false)
      used.add(ref)
      expect(regEntries.get(ref)).toBe(r.nameZh)
    }
    expect(used.size).toBe(270)
  })
  it('门禁机场中文名集合与登记表 270 名称完全一致', () => {
    const names = new Set(withRef.map((r) => r.nameZh as string))
    const regNames = new Set([...regEntries.values()])
    expect(names).toEqual(regNames)
  })
  it('港澳台与通用库机场不得携带 caacRef', () => {
    for (const r of records) {
      if (r.caacRef === undefined) continue
      expect(r.country).toBe('中国')
      if (r.icao) expect(/^(VH|VM|R)/.test(r.icao as string)).toBe(false)
    }
  })
  it('官方确认更名的机场：旧名写入 aliases（曾用名）', () => {
    const byName = (n: string) => records.find((r) => r.nameZh === n)
    const cases: Array<[string, string]> = [
      ['乌鲁木齐天山国际机场', '乌鲁木齐地窝堡国际机场'],
      ['运城盐湖国际机场', '运城张孝机场'],
      ['大兴安岭鄂伦春机场', '加格达奇嘎仙机场'],
      ['呼伦贝尔海拉尔国际机场', '呼伦贝尔海拉尔机场'],
      ['文山砚山机场', '文山普者黑机场'],
      ['锦州锦州湾机场', '锦州湾机场'],
    ]
    for (const [official, old] of cases) {
      const r = byName(official)
      expect(r, official).toBeDefined()
      expect((r?.aliases as string[]) ?? []).toContain(old)
    }
  })
})
