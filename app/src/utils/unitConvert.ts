/**
 * 离线单位换算核心（纯函数，禁止依赖 uni API，便于单测）。
 *
 * v1.1.0（迭代计划 §5）：六组固定双向换算，全部本地计算，不访问网络。
 * 除温度外拒绝负数；空值、未完成小数和无效值一律返回 null（无结果），
 * 由调用方清空对侧显示——本模块无任何内部状态，天然不复用上一次结果。
 */

export type CategoryId = 'length' | 'distance' | 'speed' | 'pressure' | 'mass' | 'temperature'

/** 方向：forward = 左单位 → 右单位（如 ft→m）；reverse = 右单位 → 左单位 */
export type Dir = 'forward' | 'reverse'

export interface CategoryDef {
  id: CategoryId
  /** 分类名（UI 切换签） */
  label: string
  /** 左侧单位（基准单位，如 ft） */
  left: string
  /** 右侧单位（如 m） */
  right: string
  /** 反向换算因子：右 = 左 × toRight（温度类不用，单独写公式） */
  toRight: (v: number) => number
  /** 正向换算因子：左 = 右 × toLeft */
  toLeft: (v: number) => number
  /** 左单位显示精度（reverse 结果） */
  precisionLeft: number
  /** 右单位显示精度（forward 结果） */
  precisionRight: number
  /** 是否允许负数（仅温度） */
  allowNegative: boolean
}

/** 计划 §5.1 固定换算关系（常数取计划给定精确值） */
const FT_TO_M = 0.3048
const NM_TO_KM = 1.852
const INHG_TO_HPA = 33.8638866667
const LB_TO_KG = 0.45359237

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'length',
    label: '长度',
    left: 'ft',
    right: 'm',
    toRight: (v) => v * FT_TO_M,
    toLeft: (v) => v / FT_TO_M,
    precisionLeft: 2,
    precisionRight: 2,
    allowNegative: false,
  },
  {
    id: 'distance',
    label: '航程',
    left: 'NM',
    right: 'km',
    toRight: (v) => v * NM_TO_KM,
    toLeft: (v) => v / NM_TO_KM,
    precisionLeft: 3,
    precisionRight: 3,
    allowNegative: false,
  },
  {
    id: 'speed',
    label: '速度',
    left: 'kt',
    right: 'km/h',
    toRight: (v) => v * NM_TO_KM,
    toLeft: (v) => v / NM_TO_KM,
    precisionLeft: 3,
    precisionRight: 3,
    allowNegative: false,
  },
  {
    id: 'pressure',
    label: '气压',
    left: 'inHg',
    right: 'hPa',
    toRight: (v) => v * INHG_TO_HPA,
    toLeft: (v) => v / INHG_TO_HPA,
    precisionLeft: 2,
    precisionRight: 1,
    allowNegative: false,
  },
  {
    id: 'mass',
    label: '质量',
    left: 'lb',
    right: 'kg',
    toRight: (v) => v * LB_TO_KG,
    toLeft: (v) => v / LB_TO_KG,
    precisionLeft: 2,
    precisionRight: 2,
    allowNegative: false,
  },
  {
    id: 'temperature',
    label: '温度',
    left: '°C',
    right: '°F',
    toRight: (v) => (v * 9) / 5 + 32,
    toLeft: (v) => ((v - 32) * 5) / 9,
    precisionLeft: 1,
    precisionRight: 1,
    allowNegative: true,
  },
]

const byId = new Map(CATEGORIES.map((c) => [c.id, c]))

/**
 * 解析输入：合法返回数值，否则 null。
 * 规则（§5.2）：空值、纯空白、未完成小数（"12."、"."）、前导小数点（".5"）、
 * 科学计数、千分位、正号、双符号、带单位尾巴等一律无效；
 * 除温度外拒绝负数。
 */
export function parseInput(raw: string, allowNegative: boolean): number | null {
  const s = raw.trim()
  if (!s) return null
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const v = Number(s)
  if (!Number.isFinite(v)) return null
  if (v < 0 && !allowNegative) return null
  return v
}

/** 格式化：按精度显示；避免 "-0.0" 这类负零显示 */
function format(v: number, precision: number): string {
  let text = v.toFixed(precision)
  if (text.startsWith('-') && Number(text) === 0) {
    text = text.slice(1)
  }
  return text
}

/**
 * 换算并格式化：无效/空/未完成输入返回 null（调用方应清空对侧，不得回退显示旧值）。
 * 返回值为按目标侧精度舍入后的字符串。
 */
export function convert(catId: CategoryId, raw: string, dir: Dir): string | null {
  const cat = byId.get(catId)
  if (!cat) return null
  const v = parseInput(raw, cat.allowNegative)
  if (v === null) return null
  return dir === 'forward'
    ? format(cat.toRight(v), cat.precisionRight)
    : format(cat.toLeft(v), cat.precisionLeft)
}
