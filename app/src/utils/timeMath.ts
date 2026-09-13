/**
 * 时间运算核心（纯函数，禁止依赖 uni API，便于单测）
 *
 * 一切时间以「分钟整数」参与运算：
 * - 时刻 (clock)：raw 为自当日 00:00 起的分钟数，可为负或超 1440（表示跨日）
 * - 时长 (duration)：raw 为时长分钟数，可超 24 小时、可为负
 */

export type TimeKind = 'clock' | 'duration'
export type Op = '+' | '-'

export interface TimeValue {
  kind: TimeKind
  raw: number
}

export interface TimeView {
  label: string
  text: string
  note?: string
}

const DAY = 1440

/** 时长格式化：H:MM（小时不补零、可超 23、可负），如 1555 → 25:55，-90 → -1:30 */
export function formatHHMM(raw: number): string {
  const sign = raw < 0 ? '-' : ''
  const abs = Math.abs(raw)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

/** 时刻视图：按 24 小时制取模显示，并给出跨日天数（次日为正、前日为负） */
export function clockView(raw: number): { text: string; dayDelta: number } {
  const dayDelta = Math.floor(raw / DAY)
  const mod = raw - dayDelta * DAY
  const h = Math.floor(mod / 60)
  const m = mod % 60
  const text = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return { text, dayDelta }
}

/** 时长视图 */
export function durationView(raw: number): string {
  return formatHHMM(raw)
}

const dayNote = (d: number): string | undefined =>
  d > 0 ? '次日' : d < 0 ? '前日' : undefined

/**
 * 双解读视图（问卷 Q7/Q8：累计与跨日时刻同显、数学结果与跨日结果同显）。
 * - 时刻结果：主显「时刻」，跨日时副显「累计」
 * - 时长结果：主显「时长」；超 24h 副显「对应时刻」；为负副显「跨日读数」
 */
export function dualViews(t: TimeValue): { primary: TimeView; secondary?: TimeView } {
  if (t.kind === 'clock') {
    const cv = clockView(t.raw)
    const primary: TimeView = { label: '时刻', text: cv.text, note: dayNote(cv.dayDelta) }
    const secondary: TimeView | undefined =
      cv.dayDelta !== 0 ? { label: '累计', text: formatHHMM(t.raw) } : undefined
    return { primary, secondary }
  }
  const primary: TimeView = { label: '时长', text: formatHHMM(t.raw) }
  let secondary: TimeView | undefined
  if (t.raw > DAY - 1) {
    const cv = clockView(t.raw)
    secondary = { label: '对应时刻', text: cv.text, note: dayNote(cv.dayDelta) }
  } else if (t.raw < 0) {
    const cv = clockView(t.raw)
    secondary = { label: '跨日读数', text: cv.text, note: dayNote(cv.dayDelta) }
  }
  return { primary, secondary }
}

/**
 * 连续数字输入的显示格式：数字从左到右填入 HH、MM，未填位显示占位符。
 * 如 "1" → "01:__"，"142" → "14:2_"，"1425" → "14:25"
 */
export function displayBuffer(buf: string): string {
  const hh = (buf.slice(0, 2) + '__').slice(0, 2)
  const rest = buf.slice(2, 4)
  const mm = (rest + '__').slice(0, 2)
  return `${hh}:${mm}`
}

/**
 * 提交 4 位数字缓冲：校验通过返回 TimeValue，非法/不完整返回 null。
 * 分钟恒须 <60；时刻小时 ≤23；时长小时 ≤99（缓冲区上限 4 位）。
 */
export function commitBuffer(buf: string, kind: TimeKind): TimeValue | null {
  if (!/^\d{4}$/.test(buf)) return null
  const hours = parseInt(buf.slice(0, 2), 10)
  const minutes = parseInt(buf.slice(2), 10)
  if (minutes > 59) return null
  const maxHours = kind === 'clock' ? 23 : 99
  if (hours > maxHours) return null
  return { kind, raw: hours * 60 + minutes }
}

/**
 * 一步运算。非法组合（时刻+时刻、时长±时刻）返回 null。
 * 结果语义：时刻±时长=时刻；时刻-时刻=时长；时长±时长=时长。
 */
export function applyOp(acc: TimeValue, op: Op, operand: TimeValue): TimeValue | null {
  if (acc.kind === 'clock') {
    if (op === '+') {
      if (operand.kind !== 'duration') return null
      return { kind: 'clock', raw: acc.raw + operand.raw }
    }
    if (operand.kind === 'duration') return { kind: 'clock', raw: acc.raw - operand.raw }
    if (operand.kind === 'clock') return { kind: 'duration', raw: acc.raw - operand.raw }
    return null
  }
  if (operand.kind !== 'duration') return null
  return { kind: 'duration', raw: op === '+' ? acc.raw + operand.raw : acc.raw - operand.raw }
}

export interface ChainStep {
  op: Op
  operand: TimeValue
}

/** 连续多步运算：任一步非法则整体失败（问卷 Q9：必须支持多步） */
export function applyChain(start: TimeValue, steps: ChainStep[]): TimeValue | null {
  let acc: TimeValue = start
  for (const s of steps) {
    const next = applyOp(acc, s.op, s.operand)
    if (next === null) return null
    acc = next
  }
  return acc
}
