/**
 * 时间计算器输入状态机（纯函数，禁止依赖 uni API，便于单测）。
 *
 * 从 time-calc.vue 提取，使「首次输入后纠错/清空」（评审 P0-1）等状态流转可被单测覆盖。
 * 页面持有该状态并消费事件（计算链文本、历史记录属于视图副作用，留在页面）。
 */
import { type TimeValue, type TimeKind, type Op, commitBuffer, applyOp } from './timeMath'

export type CalcError = '' | 'incomplete' | 'invalidClock' | 'invalidDuration' | 'badOp'

export interface CalcState {
  /** 累计值（已提交的左操作数或计算结果） */
  acc: TimeValue | null
  /** 待运算符 */
  pendingOp: Op | null
  /** 数字输入缓冲（最多 4 位） */
  buf: string
  /** 当前输入的操作数类型 */
  inputKind: TimeKind
  /** 错误码（文案映射在页面层） */
  error: CalcError
  /** acc 是否为用户直接键入的首个操作数（仅此状态允许退格取回编辑） */
  directEntry: boolean
}

export function freshState(): CalcState {
  return { acc: null, pendingOp: null, buf: '', inputKind: 'clock', error: '', directEntry: false }
}

/** 运算语义约束下的合法操作数类型 */
export function allowedKinds(s: CalcState): TimeKind[] {
  if (!s.acc || !s.pendingOp) return ['clock', 'duration']
  if (s.acc.kind === 'duration') return ['duration']
  return s.pendingOp === '+' ? ['duration'] : ['clock', 'duration']
}

/** 是否处于可输入状态：无累计值，或已有待运算符 */
export const canInput = (s: CalcState): boolean => !s.acc || !!s.pendingOp
/** 是否可键入运算符：已有累计值且无待运算符 */
export const opEnabled = (s: CalcState): boolean => !!s.acc && !s.pendingOp

export interface ComputedEvent {
  op: Op
  left: TimeValue
  right: TimeValue
  result: TimeValue
}

export type CalcEvent = { type: 'firstCommit'; value: TimeValue } | { type: 'computed'; ev: ComputedEvent } | null

export interface KeyResult {
  state: CalcState
  event: CalcEvent
}

const noEvent = (state: CalcState): KeyResult => ({ state, event: null })

/**
 * 首个操作数「取回编辑」：仅当 acc 为直接键入的首个操作数（无计算链）、
 * 未键入运算符且缓冲为空时，可还原为 4 位数字供退格修改。
 * 计算结果可能超出 4 位表示范围（负值、>99h、跨日累计），一律不可还原。
 */
function reclaimDigits(s: CalcState): string | null {
  if (!s.directEntry || !s.acc || s.pendingOp || s.buf) return null
  const raw = s.acc.raw
  if (raw < 0) return null
  const h = Math.floor(raw / 60)
  const m = raw % 60
  const maxH = s.acc.kind === 'clock' ? 23 : 99
  if (h > maxH) return null
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
}

function commit(s: CalcState): KeyResult {
  const v = commitBuffer(s.buf, s.inputKind)
  if (!v) {
    const error: CalcError = s.buf.length < 4
      ? 'incomplete'
      : s.inputKind === 'clock'
        ? 'invalidClock'
        : 'invalidDuration'
    return noEvent({ ...s, error })
  }
  if (!s.acc) {
    return {
      state: { acc: v, pendingOp: null, buf: '', inputKind: s.inputKind, error: '', directEntry: true },
      event: { type: 'firstCommit', value: v },
    }
  }
  if (!s.pendingOp) return noEvent(s)
  const op = s.pendingOp
  const r = applyOp(s.acc, op, v)
  if (!r) return noEvent({ ...s, error: 'badOp' })
  return {
    state: { acc: r, pendingOp: null, buf: '', inputKind: s.inputKind, error: '', directEntry: false },
    event: { type: 'computed', ev: { op, left: s.acc, right: v, result: r } },
  }
}

/** 键盘输入处理：数字 0-9、back（退格）、clear（C 整单重置）、add/sub */
export function pressKey(s: CalcState, k: string): KeyResult {
  if (k >= '0' && k <= '9') {
    if (!canInput(s)) return noEvent(s)
    const allowed = allowedKinds(s)
    const inputKind = allowed.includes(s.inputKind) ? s.inputKind : allowed[0]
    const buf = (s.buf + k).slice(0, 4)
    if (buf.length === 4) {
      // 4 位且合法时自动提交（连续输入最快路径）
      if (commitBuffer(buf, inputKind)) return commit({ ...s, buf, inputKind, error: '' })
      const error: CalcError = inputKind === 'clock' ? 'invalidClock' : 'invalidDuration'
      return noEvent({ ...s, buf, inputKind, error })
    }
    return noEvent({ ...s, buf, inputKind, error: '' })
  }
  if (k === 'back') {
    if (s.buf) return noEvent({ ...s, buf: s.buf.slice(0, -1), error: '' })
    const digits = reclaimDigits(s)
    if (digits) {
      return noEvent({
        acc: null,
        pendingOp: null,
        buf: digits.slice(0, -1),
        inputKind: s.inputKind,
        error: '',
        directEntry: false,
      })
    }
    return noEvent(s)
  }
  if (k === 'clear') return noEvent(freshState())
  if (k === 'add' || k === 'sub') {
    let st = s
    if (!st.acc) {
      if (st.buf) {
        const r = commit(st)
        if (!r.event) return r // 提交失败（非法/不完整），保留错误态
        st = r.state
      }
      if (!st.acc) return noEvent(st)
    } else if (st.buf && st.pendingOp) {
      const r = commit(st)
      if (!r.event) return r
      st = r.state
    }
    const op: Op = k === 'add' ? '+' : '-'
    if (st.acc && !st.pendingOp) {
      const allowed = allowedKinds({ ...st, pendingOp: op })
      const inputKind = allowed.includes(st.inputKind) ? st.inputKind : allowed[0]
      return noEvent({ ...st, pendingOp: op, buf: '', inputKind })
    }
    return noEvent(st)
  }
  return noEvent(s)
}

/**
 * 切换操作数类型（时刻/时长）。切换即对已持有的 4 位缓冲按新类型重新校验：
 * 合法则自动提交（v1.1.2 移除 ✓ 键后，这是「9930 按时刻非法 → 切时长」一类输入的兜底路径），
 * 非法则错误码随新类型刷新；缓冲不足 4 位只切类型。约束外的切换被忽略。
 */
export function switchKind(s: CalcState, kind: TimeKind): KeyResult {
  if (!allowedKinds(s).includes(kind)) return noEvent(s)
  const next: CalcState = { ...s, inputKind: kind }
  if (next.buf.length === 4) return commit(next)
  return noEvent(next)
}
