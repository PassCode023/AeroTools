import { describe, it, expect } from 'vitest'
import { tzOffsetMinutes, formatUtcOffset, tzDisplay, isDstActive } from '../src/utils/tzOffset'

// v1.1.1 时区显示（迭代计划 §6.4）：
// IANA 名称 + 当前日期对应的 UTC±HH:MM；不依赖运行时 Intl（微信 iOS JSCore 支持不完整），
// 偏移来自构建期生成的查表（app/src/static/tzoffsets.json）。
// 约定：偏移为"东经正"分钟数（UTC+8 → 480），与 getTimezoneOffset 相反。

describe('formatUtcOffset', () => {
  it('正偏移', () => {
    expect(formatUtcOffset(480)).toBe('UTC+08:00')
    expect(formatUtcOffset(330)).toBe('UTC+05:30')
  })
  it('负偏移', () => {
    expect(formatUtcOffset(-300)).toBe('UTC-05:00')
  })
  it('零偏移', () => {
    expect(formatUtcOffset(0)).toBe('UTC+00:00')
  })
})

describe('tzOffsetMinutes（构建期查表）', () => {
  it('Asia/Shanghai 恒为 +480', () => {
    expect(tzOffsetMinutes('Asia/Shanghai', new Date('2026-07-15T00:00:00Z'))).toBe(480)
    expect(tzOffsetMinutes('Asia/Shanghai', new Date('2026-01-15T00:00:00Z'))).toBe(480)
  })
  it('America/New_York 夏令时：2026-07-15 → -240', () => {
    expect(tzOffsetMinutes('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(-240)
  })
  it('America/New_York 冬季：2026-01-15 → -300', () => {
    expect(tzOffsetMinutes('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(-300)
  })
  it('未知时区返回 null', () => {
    expect(tzOffsetMinutes('Mars/Olympus', new Date())).toBeNull()
    expect(tzOffsetMinutes('', new Date())).toBeNull()
  })
})

describe('isDstActive（夏令时提示，只展示当前偏移）', () => {
  it('纽约夏季执行夏令时', () => {
    expect(isDstActive('America/New_York', new Date('2026-07-15T12:00:00Z'))).toBe(true)
  })
  it('纽约冬季不执行', () => {
    expect(isDstActive('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(false)
  })
  it('上海恒为否', () => {
    expect(isDstActive('Asia/Shanghai', new Date('2026-07-15T12:00:00Z'))).toBe(false)
  })
  it('未知时区为否', () => {
    expect(isDstActive('Mars/Olympus', new Date())).toBe(false)
  })
})

describe('tzDisplay（详情行文案）', () => {
  it('IANA + 当前偏移', () => {
    expect(tzDisplay('Asia/Shanghai', new Date('2026-09-15T00:00:00Z'))).toBe('Asia/Shanghai（UTC+08:00）')
  })
  it('缺失时区显示 —', () => {
    expect(tzDisplay(undefined, new Date())).toBe('—')
    expect(tzDisplay('', new Date())).toBe('—')
  })
  it('不支持/非法时区显示 当前偏移不可用', () => {
    expect(tzDisplay('Mars/Olympus', new Date())).toBe('当前偏移不可用')
  })
})
