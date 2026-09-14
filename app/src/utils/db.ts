/**
 * 机场数据库加载/存储。
 *
 * 内置库打包在 src/static/airports.json；在线更新后的库分块写入本地存储
 * （规避微信小程序单 key 1MB 限制）。本地版本 >= 内置版本时优先用本地。
 *
 * 写入协议（v2，评审 P0-3 修复）：
 * - 分块键带版本号：`at:db:chunk:<version>:<i>`，meta 为唯一提交点；
 *   新库全部分块写入成功后才写 meta，中途失败旧库 meta/分块均未被触碰。
 * - v1 兼容：旧版本使用固定键 `at:db:chunk:<i>`，loadDb 在版本化键缺失时回读。
 * - 成功提交后按旧 meta 清理旧分块（版本化键 + legacy 键），
 *   极端中断遗留的孤立键不影响正确性，仅在下次成功保存时不被清（可忽略）。
 */
import type { Airport } from './airportSearch'
import { getItem, setItem, removeItem } from './storage'
import bundledAirports from '../static/airports.json'
import bundledVersion from '../dbversion.json'

const META_KEY = 'at:db:meta'
const CHUNK_PREFIX = 'at:db:chunk:'
const CHUNK_SIZE = 400

/** 数据溯源信息（随库保存并在 UI 展示，评审 P0-2；v1.0.2 起结构化） */
export interface DbSourceInfo {
  sources?: Array<{ name: string; url: string; license: string; usage: string }>
  dataAsOf?: string
  verifiedAt?: string
  coverage?: { expected: number; matched: number; asOf: string }
  completeness?: Record<string, number>
}

interface DbMeta extends DbSourceInfo {
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

const chunkKey = (version: string, i: number): string => `${CHUNK_PREFIX}${version}:${i}`
const legacyChunkKey = (i: number): string => `${CHUNK_PREFIX}${i}`

function readChunks(keys: string[], count: number): Airport[] | null {
  const parts: Airport[] = []
  for (const key of keys) {
    const chunk = getItem<Airport[]>(key)
    if (chunk && chunk.length) parts.push(...chunk)
    else return null
  }
  return parts.length === count ? parts : null
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

export interface DbInfo extends DbSourceInfo {
  version: string
  count: number
  updatedAt: string
  fromRemote: boolean
}

/** 当前生效数据库的完整信息（版本/条数/更新时间/来源），供首页实时展示 */
export function currentInfo(): DbInfo {
  const meta = getItem<DbMeta>(META_KEY)
  if (meta && compareVersion(meta.version, bundledVersion.version) >= 0) {
    return {
      version: meta.version,
      count: meta.count,
      updatedAt: meta.updatedAt,
      fromRemote: true,
      sources: meta.sources,
      dataAsOf: meta.dataAsOf,
      verifiedAt: meta.verifiedAt,
      coverage: meta.coverage,
      completeness: meta.completeness,
    }
  }
  return {
    version: bundledVersion.version,
    count: bundledVersion.count,
    updatedAt: bundledVersion.updatedAt,
    fromRemote: false,
    sources: bundledVersion.sources,
    dataAsOf: bundledVersion.dataAsOf,
    verifiedAt: bundledVersion.verifiedAt,
    coverage: bundledVersion.coverage,
    completeness: bundledVersion.completeness,
  }
}

/** 加载生效数据库（带模块级缓存） */
export function loadDb(): Airport[] {
  if (cache) return cache
  const meta = getItem<DbMeta>(META_KEY)
  if (meta && meta.version && meta.chunks > 0 && compareVersion(meta.version, bundledVersion.version) >= 0) {
    const keys = Array.from({ length: meta.chunks }, (_, i) => chunkKey(meta.version, i))
    const parts = readChunks(keys, meta.count)
    if (parts) {
      cache = parts
      return cache
    }
    // v1 迁移：旧安装的分块在固定键上
    const legacyKeys = Array.from({ length: meta.chunks }, (_, i) => legacyChunkKey(i))
    const legacyParts = readChunks(legacyKeys, meta.count)
    if (legacyParts) {
      cache = legacyParts
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

/**
 * 分块保存下载数据库（原子写入）：
 * 先写带版本号的分块键，全部成功后再写 meta（唯一提交点）；
 * 任一步失败即回滚已写的新键并返回 false，旧库 meta/分块未被触碰，保持完整可用。
 * 提交成功后按写入前快照的旧 meta 清理旧库分块（版本化键 + v1 legacy 键）。
 */
export function saveDb(airports: Airport[], version: string, updatedAt: string, extra: DbSourceInfo = {}): boolean {
  const chunks: Airport[][] = []
  for (let i = 0; i < airports.length; i += CHUNK_SIZE) {
    chunks.push(airports.slice(i, i + CHUNK_SIZE))
  }
  const keys = chunks.map((_, i) => chunkKey(version, i))
  for (let i = 0; i < chunks.length; i++) {
    if (!setItem(keys[i], chunks[i])) {
      for (let j = 0; j <= i; j++) removeItem(keys[j])
      return false
    }
  }
  // 快照旧 meta：提交成功后据此清理旧库分块（含块数变多的旧库与 legacy 固定键）
  const oldMeta = getItem<DbMeta>(META_KEY)
  const meta: DbMeta = { version, count: airports.length, chunks: chunks.length, updatedAt, ...extra }
  if (!setItem(META_KEY, meta)) {
    for (const key of keys) removeItem(key)
    return false
  }
  if (oldMeta && compareVersion(oldMeta.version, version) !== 0) {
    for (let i = 0; i < oldMeta.chunks; i++) {
      removeItem(chunkKey(oldMeta.version, i))
      removeItem(legacyChunkKey(i))
    }
  }
  cache = null
  return true
}

/** 清除本地更新的库（回退内置） */
export function clearLocalDb(): void {
  const meta = getItem<DbMeta>(META_KEY)
  if (meta) {
    for (let i = 0; i < meta.chunks; i++) {
      removeItem(chunkKey(meta.version, i))
      removeItem(legacyChunkKey(i))
    }
  }
  removeItem(META_KEY)
  cache = null
}
