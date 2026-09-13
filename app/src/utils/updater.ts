/**
 * 机场数据库在线更新（问卷 Q20/Q21：检测到新版提示用户确认；Wi-Fi/移动网络均可下载）。
 *
 * 流程：GET manifest.json → 版本比较 → 用户确认 → 下载数据包 →
 * 结构校验 → 分块写入本地 → 失败保留旧库。
 */
import { DB_UPDATE_BASE_URL } from '../config'
import { compareVersion, currentVersion, saveDb, bundledInfo } from './db'
import type { Airport } from './airportSearch'

export interface Manifest {
  version: string
  count: number
  updatedAt: string
  file: string
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

/** 下载并应用新数据库；写入失败返回 false，旧库不受影响 */
export async function downloadAndApply(manifest: Manifest): Promise<boolean> {
  const data = await request<unknown>(`${DB_UPDATE_BASE_URL}/${manifest.file}`, 30000)
  if (!Array.isArray(data) || data.length !== manifest.count) {
    throw new Error('数据包校验失败（条数不符）')
  }
  return saveDb(data as Airport[], manifest.version, manifest.updatedAt)
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
