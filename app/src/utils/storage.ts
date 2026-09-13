/** 本地存储统一封装：所有平台（APP/小程序/H5）走 uni.*Storage 同步 API */

export function getItem<T>(key: string): T | null {
  try {
    const v = uni.getStorageSync(key)
    return (v === '' || v === undefined || v === null) ? null : (v as T)
  } catch {
    return null
  }
}

export function setItem(key: string, value: unknown): boolean {
  try {
    uni.setStorageSync(key, value)
    return true
  } catch {
    return false
  }
}

export function removeItem(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch {
    /* 忽略 */
  }
}
