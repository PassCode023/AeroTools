/**
 * 机场数据库在线更新（问卷 Q20/Q21：检测到新版提示用户确认；Wi-Fi/移动网络均可下载）。
 *
 * 流程：GET manifest.json → 版本比较 → 用户确认 → 下载数据包 →
 * 逐字段结构校验 → 原子写入本地（meta 提交点）→ 失败旧库完好。
 */
import { DB_UPDATE_BASE_URL } from '../config'
import { compareVersion, currentVersion, saveDb, bundledInfo } from './db'
import type { Airport } from './airportSearch'

export interface ManifestSource {
  name: string
  url: string
  license: string
  usage: string
}

export interface Manifest {
  version: string
  count: number
  updatedAt: string
  file: string
  /** 数据溯源（v1.0.2 起结构化，与内置 dbversion.json 同构） */
  sources?: ManifestSource[]
  dataAsOf?: string
  verifiedAt?: string
  coverage?: { expected: number; matched: number; asOf: string }
  completeness?: Record<string, number>
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'not-configured' }
  | { state: 'checking' }
  | { state: 'up-to-date'; version: string }
  | { state: 'available'; manifest: Manifest }
  | { state: 'downloading' }
  | { state: 'success'; version: string }
  | { state: 'error'; message: string }

function request<T>(url: string, timeout = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data as T)
        else reject(new Error(`HTTP ${res.statusCode}`))
      },
      fail: (err) => reject(new Error(err.errMsg || '网络请求失败')),
    })
  })
}

function validManifest(m: unknown): m is Manifest {
  const x = m as Manifest
  return (
    !!x &&
    typeof x.version === 'string' &&
    /^\d{4}\.\d{1,2}\.\d{1,2}$/.test(x.version) &&
    typeof x.count === 'number' &&
    typeof x.file === 'string' &&
    /^[\w.-]+\.json$/.test(x.file)
  )
}

/** 检查是否有新版本（服务端未配置或网络失败均视为无更新） */
export async function checkForUpdate(): Promise<UpdateStatus> {
  if (!DB_UPDATE_BASE_URL) return { state: 'not-configured' }
  try {
    const m = await request<unknown>(`${DB_UPDATE_BASE_URL}/manifest.json`)
    if (!validManifest(m)) return { state: 'error', message: '更新清单格式非法' }
    if (compareVersion(m.version, currentVersion()) > 0) {
      return { state: 'available', manifest: m }
    }
    return { state: 'up-to-date', version: currentVersion() }
  } catch (e) {
    // 手动检查时把网络错误暴露给页面；启动静默检查由调用方吞掉
    return { state: 'error', message: (e as Error).message }
  }
}

/**
 * 下载数据包的结构校验（与内置数据契约一致，v1.0.2 起）：
 * 数组、条数与清单一致、仅中文名与国家必填；坐标存在时须为合法数字。
 * 校验失败抛错，由调用方转为用户可见错误；旧库不受影响。
 */
export function validateAirportData(data: unknown, expectedCount: number): Airport[] {
  if (!Array.isArray(data)) throw new Error('数据包校验失败（非数组）')
  if (data.length !== expectedCount) throw new Error('数据包校验失败（条数不符）')
  const required = ['nameZh', 'country'] as const
  for (const r of data) {
    const a = r as Record<string, unknown>
    for (const k of required) {
      if (typeof a[k] !== 'string' || !(a[k] as string).trim()) {
        throw new Error(`数据包校验失败（记录缺少 ${k}）`)
      }
    }
    if (a.lat !== undefined && (typeof a.lat !== 'number' || a.lat < -90 || a.lat > 90)) {
      throw new Error('数据包校验失败（坐标非法）')
    }
    if (a.lng !== undefined && (typeof a.lng !== 'number' || a.lng < -180 || a.lng > 180)) {
      throw new Error('数据包校验失败（坐标非法）')
    }
  }
  return data as Airport[]
}

/** 下载并应用新数据库：结构校验通过后经 saveDb 原子写入；失败时旧库保持完整可用 */
export async function downloadAndApply(manifest: Manifest): Promise<boolean> {
  const data = await request<unknown>(`${DB_UPDATE_BASE_URL}/${manifest.file}`, 30000)
  const airports = validateAirportData(data, manifest.count)
  return saveDb(airports, manifest.version, manifest.updatedAt, {
    sources: manifest.sources,
    dataAsOf: manifest.dataAsOf,
    verifiedAt: manifest.verifiedAt,
    coverage: manifest.coverage,
    completeness: manifest.completeness,
  })
}

export interface CheckUi {
  /** 发现新版本时弹确认框（问卷要求） */
  confirm?: (m: Manifest) => Promise<boolean>
  onStatus?: (s: UpdateStatus) => void
}

/**
 * 完整「检查 → 确认 → 下载 → 应用」流程。
 * 静默失败用于启动自动检查：任何 error 都不弹窗打扰（仅手动检查时展示错误）。
 */
export async function checkAndPrompt(ui: CheckUi = {}, silent = false): Promise<UpdateStatus> {
  const emit = (s: UpdateStatus) => ui.onStatus?.(s)
  emit({ state: 'checking' })
  const s = await checkForUpdate()
  if (s.state !== 'available') {
    emit(s)
    return s
  }
  emit(s)
  const ok = ui.confirm
    ? await ui.confirm(s.manifest)
    : await new Promise<boolean>((resolve) => {
        uni.showModal({
          title: '发现机场数据库更新',
          content: `新版本 ${s.manifest.version}（${s.manifest.count} 家机场，发布于 ${s.manifest.updatedAt}）。是否立即下载？`,
          confirmText: '下载更新',
          success: (r) => resolve(!!r.confirm),
          fail: () => resolve(false),
        })
      })
  if (!ok) return { state: 'idle' }
  emit({ state: 'downloading' })
  try {
    const applied = await downloadAndApply(s.manifest)
    if (!applied) throw new Error('本地存储写入失败')
    const done: UpdateStatus = { state: 'success', version: s.manifest.version }
    emit(done)
    return done
  } catch (e) {
    const err: UpdateStatus = { state: 'error', message: (e as Error).message }
    emit(err)
    return err
  }
}

/** 当前版本展示文案 */
export function versionLabel(): string {
  const b = bundledInfo()
  return currentVersion() === b.version ? b.version : `${currentVersion()}（内置 ${b.version}）`
}
