/** 时间计算历史记录（问卷 Q10：有价值但非必须，保持轻量） */
import { getItem, setItem } from './storage'
import { HISTORY_LIMIT } from '../config'

export interface HistoryEntry {
  expr: string
  primary: string
  primaryNote?: string
  secondary?: string
  ts: number
}

const KEY = 'at:calc:history'

export function loadHistory(): HistoryEntry[] {
  return getItem<HistoryEntry[]>(KEY) || []
}

export function addHistory(entry: HistoryEntry): void {
  const list = loadHistory()
  list.unshift(entry)
  if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT
  setItem(KEY, list)
}

export function clearHistory(): void {
  setItem(KEY, [])
}
