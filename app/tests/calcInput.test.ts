import { describe, it, expect } from 'vitest'
import {
  freshState,
  pressKey,
  canInput,
  opEnabled,
  allowedKinds,
  type CalcState,
} from '../src/utils/calcInput'

/** 便捷构造:依次按键,收集事件(键名与 num-keypad 发出的 ID 一致) */
function press(s: CalcState, ...keys: string[]): { state: CalcState; events: unknown[] } {
  let cur = s
  const events: unknown[] = []
  for (const k of keys) {
    const r = pressKey(cur, k)
    cur = r.state
    if (r.event) events.push(r.event)
  }
  return { state: cur, events }
}

describe('基础输入(保持既有行为)', () => {
  it('连续输入 1425 自动提交首个时刻', () => {
    const { state, events } = press(freshState(), '1', '4', '2', '5')
    expect(state.acc).toEqual({ kind: 'clock', raw: 14 * 60 + 25 })
    expect(state.buf).toBe('')
    expect(state.directEntry).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'firstCommit', value: { kind: 'clock', raw: 865 } })
  })
  it('输入中退格删除末位', () => {
    const { state } = press(freshState(), '1', '4', '2', 'back')
    expect(state.buf).toBe('14')
    expect(state.acc).toBeNull()
  })
  it('时刻 9999 拒绝自动提交并报 invalidClock', () => {
    const { state } = press(freshState(), '9', '9', '9', '9')
    expect(state.acc).toBeNull()
    expect(state.error).toBe('invalidClock')
    expect(state.buf).toBe('9999')
  })
  it('非法四位数退格后可重输为合法时刻', () => {
    let s = press(freshState(), '9', '9', '9', '9').state
    s = press(s, 'back', 'back', 'back', 'back').state
    expect(s.buf).toBe('')
    s = press(s, '2', '3', '3', '0').state
    expect(s.acc).toEqual({ kind: 'clock', raw: 23 * 60 + 30 })
    expect(s.error).toBe('')
  })
  it('ok 键提交不完整缓冲报 incomplete', () => {
    const { state } = press(freshState(), '1', '2', 'ok')
    expect(state.error).toBe('incomplete')
  })
  it('输入中按 clear 清空缓冲回到初始状态', () => {
    const { state } = press(freshState(), '1', '4', 'clear')
    expect(state).toEqual(freshState())
  })
})

describe('P0-1 首次输入后的纠错与清空', () => {
  it('自动提交后按退格可回到编辑态并删除最后一位', () => {
    const { state: committed } = press(freshState(), '1', '4', '2', '5')
    expect(committed.acc).not.toBeNull()
    const { state } = press(committed, 'back')
    expect(state.acc).toBeNull()
    expect(state.buf).toBe('142')
    expect(state.error).toBe('')
    // 修改末位后重新自动提交
    const { state: fixed } = press(state, '3')
    expect(fixed.acc).toEqual({ kind: 'clock', raw: 14 * 60 + 23 })
    expect(fixed.buf).toBe('')
  })
  it('自动提交后按 clear 直接开始一笔新计算', () => {
    const { state: committed } = press(freshState(), '1', '4', '2', '5')
    const { state } = press(committed, 'clear')
    expect(state).toEqual(freshState())
    // 新计算可用
    const { state: next } = press(state, '0', '8', '3', '0')
    expect(next.acc).toEqual({ kind: 'clock', raw: 8 * 60 + 30 })
  })
  it('完成运算后按退格不破坏已提交结果', () => {
    const { state: done } = press(freshState(), '1', '4', '2', '5', 'add', '0', '2', '1', '5')
    expect(done.acc).toEqual({ kind: 'clock', raw: 14 * 60 + 25 + 2 * 60 + 15 })
    expect(done.directEntry).toBe(false)
    const { state } = press(done, 'back')
    expect(state.acc).toEqual(done.acc)
    expect(state.buf).toBe('')
  })
  it('完成运算后按 clear 清空全部状态开始新计算', () => {
    const { state: done } = press(freshState(), '1', '4', '2', '5', 'add', '0', '2', '1', '5')
    const { state } = press(done, 'clear')
    expect(state).toEqual(freshState())
  })
  it('运算中间态按 clear 清空(已键入运算对象缓冲一并清除)', () => {
    const mid = press(freshState(), '1', '4', '2', '5', 'add', '0', '2').state
    expect(mid.pendingOp).toBe('+')
    const { state } = press(mid, 'clear')
    expect(state).toEqual(freshState())
  })
})

describe('运算与类型约束(保持既有行为)', () => {
  it('时刻 + 时长 产生 computed 事件与正确结果', () => {
    const { state, events } = press(freshState(), '2', '3', '3', '0', 'add', '0', '2', '1', '5')
    expect(state.acc).toEqual({ kind: 'clock', raw: 23 * 60 + 30 + 135 })
    expect(state.pendingOp).toBeNull()
    expect(state.directEntry).toBe(false)
    expect(events[1]).toMatchObject({
      type: 'computed',
      ev: { op: '+', result: { kind: 'clock', raw: 1545 } },
    })
  })
  it('时刻 + 之后锁定为时长输入', () => {
    let s = press(freshState(), '2', '3', '3', '0').state
    s = press(s, 'add').state
    expect(s.pendingOp).toBe('+')
    expect(s.inputKind).toBe('duration')
    expect(allowedKinds(s)).toEqual(['duration'])
    expect(canInput(s)).toBe(true)
    expect(opEnabled(s)).toBe(false)
  })
  it('时刻 - 时刻 产生时长结果(10:00 − 9:30 = 0:30)', () => {
    const { state } = press(freshState(), '1', '0', '0', '0', 'sub', '0', '9', '3', '0')
    expect(state.acc).toEqual({ kind: 'duration', raw: 30 })
  })
  it('防御分支:不合法组合报 badOp 且保留状态(直接构造状态)', () => {
    const s: CalcState = {
      acc: { kind: 'duration', raw: 120 },
      pendingOp: '-',
      buf: '0130',
      inputKind: 'clock',
      error: '',
      directEntry: false,
    }
    const r = pressKey(s, 'ok')
    expect(r.state.error).toBe('badOp')
    expect(r.state.acc).toEqual({ kind: 'duration', raw: 120 })
    expect(r.event).toBeNull()
  })
  it('缓冲不足 4 位时按运算符报 incomplete 不提交(保持既有行为)', () => {
    const { state } = press(freshState(), '1', '4', '2', 'add')
    expect(state.acc).toBeNull()
    expect(state.error).toBe('incomplete')
    expect(state.pendingOp).toBeNull()
  })
  it('已提交首个操作数时数字键被忽略(需退格或运算符)', () => {
    const committed = press(freshState(), '1', '4', '2', '5').state
    const { state } = press(committed, '3')
    expect(state.acc).toEqual({ kind: 'clock', raw: 14 * 60 + 25 })
    expect(state.buf).toBe('')
  })
})
