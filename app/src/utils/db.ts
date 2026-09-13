/**
 * 机场数据库加载/存储。
 *
 * 内置库打包在 src/static/airports.json；在线更新后的库分块写入本地存储
 * （规避微信小程序单 key 1MB 限制）。本地版本 >= 内置版本时优先用本地。
 */
import type { Airport } from './airportSearch'
import { getItem, setItem, removeItem } from './storage'
import bundledAirports from '../static/airports.json'
import bundledVersion from '../dbversion.json'

const META_KEY = 'at:db:meta'
const CHUNK_PREFIX = 'at:db:chunk:'
const CHUNK_SIZE = 400

interface DbMeta {
  version: string
  count: number
  chunks: number
  updatedAt: string
}

let cache: Airport[] | null = null

/** 版本比较：a>b 返回 1，a<b 返回 -1，相等 0（YYYY.M.N 逐段数值比较） */
export function compareVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

/** 当前生效的数据库版本号 */
export function currentVersion(): string {
  const meta = getItem<DbMeta>(META_KEY)
  if (meta && compareVersion(meta.version, bundledVersion.version) >= 0) {
    return meta.version
  }
  return bundledVersion.version
}

/** 当前生效的数据库是否来自在线更新（而非内置） */
export function isRemoteDb(): boolean {
  const meta = getItem<DbMeta>(META_KEY)
  return !!meta && compareVersion(meta.version, bundledVersion.version) >= 0
}

export interface DbInfo {
  version: string
  count: number
  updatedAt: string
  fromRemote: boolean
}

/** 当前生效数据库的完整信息（版本/条数/更新时间/来源），供首页实时展示 */
export function currentInfo(): DbInfo {
  const meta = getItem<DbMeta>(META_KEY)
  if (meta && compareVersion(meta.version, bundledVersion.version) >= 0) {
    return { version: meta.version, count: meta.count, updatedAt: meta.updatedAt, fromRemote: true }
  }
  return {
    version: bundledVersion.version,
    count: bundledVersion.count,
    updatedAt: bundledVersion.updatedAt,
    fromRemote: false,
  }
}

/** 加载生效数据库（带模块级缓存） */
export function loadDb(): Airport[] {
  if (cache) return cache
  const meta = getItem<DbMeta>(META_KEY)
  if (meta && meta.version && compareVersion(meta.version, bundledVersion.version) >= 0) {
    const parts: Airport[] = []
    let ok = true
    for (let i = 0; i < meta.chunks; i++) {
      const chunk = getItem<Airport[]>(CHUNK_PREFIX + i)
      if (chunk && chunk.length) parts.push(...chunk)
      else { ok = false; break }
    }
    if (ok && parts.length === meta.count) {
      cache = parts
      return cache
    }
    // 本地数据损坏 → 清掉，回退内置
    clearLocalDb()
  }
  cache = bundledAirports as unknown as Airport[]
  return cache
}

/** 内置数据库的版本信息 */
export function bundledInfo(): { version: string; count: number; updatedAt: string } {
  return bundledVersion
}

/** 分块保存下载数据库；任一块写入失败返回 false（调用方保留旧库） */
export function saveDb(airports: Airport[], version: string, updatedAt: string): boolean {
  const chunks: Airport[][] = []
  for (let i = 0; i < airports.length; i += CHUNK_SIZE) {
    chunks.push(airports.slice(i, i + CHUNK_SIZE))
  }
  const meta: DbMeta = { version, count: airports.length, chunks: chunks.length, updatedAt }
  // 先写数据块，最后写 meta（meta 在场即数据完整）
  for (let i = 0; i < chunks.length; i++) {
    if (!setItem(CHUNK_PREFIX + i, chunks[i])) return false
  }
  if (!setItem(META_KEY, meta)) return false
  cache = null
  return true
}

/** 清除本地更新的库（回退内置） */
export function clearLocalDb(): void {
  const meta = getItem<DbMeta>(META_KEY)
  if (meta) {
    for (let i = 0; i < meta.chunks; i++) removeItem(CHUNK_PREFIX + i)
  }
  removeItem(META_KEY)
  cache = null
}
