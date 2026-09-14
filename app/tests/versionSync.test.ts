import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import pkg from '../package.json'
import { APP_VERSION } from '../src/config'

// 版本一致性门禁：release 升版时 package.json / src/manifest.json（versionName、
// versionCode）/ src/config.ts（APP_VERSION）三处必须同步。
// 由来：v1.1.1 升版时漏改 APP_VERSION，设置页"应用版本"仍显示 1.0.2。

const manifestText = readFileSync(new URL('../src/manifest.json', import.meta.url), 'utf8')
const versionName = /"versionName"\s*:\s*"([^"]+)"/.exec(manifestText)?.[1] ?? ''
const versionCode = /"versionCode"\s*:\s*"?(\d+)"?/.exec(manifestText)?.[1] ?? ''

describe('版本一致性', () => {
  it('package.json、manifest.json versionName、APP_VERSION 三处一致', () => {
    expect(versionName).toBe(pkg.version)
    expect(APP_VERSION).toBe(pkg.version)
  })
  it('versionCode 与版本号对应（1.1.1 → 111）', () => {
    const [major, minor, patch] = pkg.version.split('.').map(Number)
    expect(versionCode).toBe(String(major * 100 + minor * 10 + patch))
  })
})
