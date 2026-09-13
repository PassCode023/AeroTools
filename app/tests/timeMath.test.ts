import { describe, it, expect } from 'vitest'
import {
  formatHHMM,
  clockView,
  durationView,
  dualViews,
  commitBuffer,
  applyOp,
  applyChain,
  type TimeValue,
} from '../src/utils/timeMath'

const clock = (h: number, m: number): TimeValue => ({ kind: 'clock', raw: h * 60 + m })
const dur = (m: number): TimeValue => ({ kind: 'duration', raw: m })

describe('formatHHMM', () => {
  it('零点', () => expect(formatHHMM(0)).toBe('0:00'))
  it('常规时刻', () => expect(formatHHMM(605)).toBe('10:05'))
  it('超过24小时', () => expect(formatHHMM(1555)).toBe('25:55'))
  it('负数', () => expect(formatHHMM(-90)).toBe('-1:30'))
  it('负数带余分', () => expect(formatHHMM(-725)).toBe('-12:05'))
})

describe('clockView', () => {
  it('当日时刻', () => {
    expect(clockView(600)).toEqual({ text: '10:00', dayDelta: 0 })
  })
  it('跨次日', () => {
    expect(clockView(1555)).toEqual({ text: '01:55', dayDelta: 1 })
  })
  it('恰好在午夜', () => {
    expect(clockView(1440)).toEqual({ text: '00:00', dayDelta: 1 })
  })
  it('跨前一日', () => {
    expect(clockView(-60)).toEqual({ text: '23:00', dayDelta: -1 })
  })
})

describe('durationView', () => {
  it('常规时长', () => expect(durationView(90)).toBe('1:30'))
  it('累计超24小时', () => expect(durationView(1555)).toBe('25:55'))
  it('零', () => expect(durationView(0)).toBe('0:00'))
  it('负时长', () => expect(durationView(-90)).toBe('-1:30'))
})

describe('dualViews（问卷 Q7/Q8：双解读同显）', () => {
  it('时刻结果跨午夜：时刻 + 累计', () => {
    const v = dualViews(clock(23, 30).kind === 'clock' ? { kind: 'clock', raw: 23 * 60 + 30 + 135 } : clock(0, 0))
    expect(v.primary).toEqual({ label: '时刻', text: '01:45', note: '次日' })
    expect(v.secondary).toEqual({ label: '累计', text: '25:45' })
  })
  it('时刻结果未跨日：只有时刻', () => {
    const v = dualViews({ kind: 'clock', raw: 600 })
    expect(v.primary).toEqual({ label: '时刻', text: '10:00', note: undefined })
    expect(v.secondary).toBeUndefined()
  })
  it('时刻结果跨前一日：时刻 + 累计（负）', () => {
    const v = dualViews({ kind: 'clock', raw: -150 })
    expect(v.primary).toEqual({ label: '时刻', text: '21:30', note: '前日' })
    expect(v.secondary).toEqual({ label: '累计', text: '-2:30' })
  })
  it('时长结果超24h：时长 + 对应时刻', () => {
    const v = dualViews({ kind: 'duration', raw: 1555 })
    expect(v.primary).toEqual({ label: '时长', text: '25:55' })
    expect(v.secondary).toEqual({ label: '对应时刻', text: '01:55', note: '次日' })
  })
  it('时长结果为负：数学结果 + 跨日读数', () => {
    const v = dualViews({ kind: 'duration', raw: -150 })
    expect(v.primary).toEqual({ label: '时长', text: '-2:30' })
    expect(v.secondary).toEqual({ label: '跨日读数', text: '21:30', note: '前日' })
  })
  it('时长结果正常：只有时长', () => {
    const v = dualViews(dur(90))
    expect(v.primary).toEqual({ label: '时长', text: '1:30' })
    expect(v.secondary).toBeUndefined()
  })
})

describe('commitBuffer（连续数字输入自动格式化）', () => {
  it('时刻 1425 → 14:25', () => {
    expect(commitBuffer('1425', 'clock')).toEqual({ kind: 'clock', raw: 865 })
  })
  it('时刻补零 0800 → 08:00', () => {
    expect(commitBuffer('0800', 'clock')).toEqual({ kind: 'clock', raw: 480 })
  })
  it('时刻小时>23 非法', () => {
    expect(commitBuffer('9925', 'clock')).toBeNull()
  })
  it('时刻分钟>59 非法', () => {
    expect(commitBuffer('1475', 'clock')).toBeNull()
  })
  it('不完整输入', () => {
    expect(commitBuffer('142', 'clock')).toBeNull()
    expect(commitBuffer('', 'clock')).toBeNull()
  })
  it('时长 9959 → 99:59', () => {
    expect(commitBuffer('9959', 'duration')).toEqual({ kind: 'duration', raw: 99 * 60 + 59 })
  })
  it('时长分钟>59 非法', () => {
    expect(commitBuffer('0075', 'duration')).toBeNull()
  })
  it('时长 0800 → 8:00', () => {
    expect(commitBuffer('0800', 'duration')).toEqual({ kind: 'duration', raw: 480 })
  })
})

describe('applyOp（运算合法性 + 结果语义）', () => {
  it('时刻+时长 跨午夜', () => {
    expect(applyOp(clock(23, 30), '+', dur(135))).toEqual({ kind: 'clock', raw: 1545 })
  })
  it('时刻-时长 跨前一日', () => {
    expect(applyOp(clock(8, 0), '-', dur(630))).toEqual({ kind: 'clock', raw: -150 })
  })
  it('时刻-时刻=时长（正）', () => {
    expect(applyOp(clock(10, 30), '-', clock(8, 0))).toEqual({ kind: 'duration', raw: 150 })
  })
  it('时刻-时刻=时长（负）', () => {
    expect(applyOp(clock(8, 0), '-', clock(10, 30))).toEqual({ kind: 'duration', raw: -150 })
  })
  it('时长+时长', () => {
    expect(applyOp(dur(300), '+', dur(200))).toEqual({ kind: 'duration', raw: 500 })
  })
  it('时长-时长（负）', () => {
    expect(applyOp(dur(300), '-', dur(500))).toEqual({ kind: 'duration', raw: -200 })
  })
  it('时刻+时长=0 边界', () => {
    expect(applyOp(clock(23, 59), '+', dur(1))).toEqual({ kind: 'clock', raw: 1440 })
  })
  it('时刻+时刻 非法', () => {
    expect(applyOp(clock(8, 0), '+', clock(9, 0))).toBeNull()
  })
  it('时长±时刻 非法', () => {
    expect(applyOp(dur(100), '+', clock(9, 0))).toBeNull()
    expect(applyOp(dur(100), '-', clock(9, 0))).toBeNull()
  })
})

describe('applyChain（连续多步计算，问卷 Q9 必须）', () => {
  it('多步链：起飞 10:00 + 飞行 2:10 - 滑回 0:15 = 11:55', () => {
    const r = applyChain(clock(10, 0), [
      { op: '+', operand: dur(130) },
      { op: '-', operand: dur(15) },
    ])
    expect(r).toEqual({ kind: 'clock', raw: 11 * 60 + 55 })
  })
  it('多段航段时长累计', () => {
    const r = applyChain(dur(130), [
      { op: '+', operand: dur(95) },
      { op: '+', operand: dur(80) },
    ])
    expect(r).toEqual({ kind: 'duration', raw: 305 })
  })
  it('链中一步非法则整体返回 null', () => {
    const r = applyChain(clock(10, 0), [
      { op: '+', operand: dur(60) },
      { op: '+', operand: clock(9, 0) },
    ])
    expect(r).toBeNull()
  })
})
