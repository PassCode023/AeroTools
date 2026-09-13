<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  type TimeValue,
  type TimeKind,
  type Op,
  clockView,
  durationView,
  dualViews,
  displayBuffer,
  commitBuffer,
  applyOp,
} from '../../utils/timeMath'
import { loadHistory, addHistory, clearHistory, type HistoryEntry } from '../../utils/calcHistory'
import { useTheme, syncNavBar } from '../../utils/theme'
import NumKeypad from '../../components/num-keypad.vue'

const { themeClass } = useTheme()

/* ---- 计算链状态 ---- */
const acc = ref<TimeValue | null>(null)
const pendingOp = ref<Op | null>(null)
const buf = ref('')
const inputKind = ref<TimeKind>('clock')
const steps = ref<string[]>([])
const error = ref('')

/* ---- 历史记录 ---- */
const historyOpen = ref(false)
const history = ref<HistoryEntry[]>([])

onShow(() => {
  syncNavBar()
  history.value = loadHistory()
})

/** 当前输入允许的操作数类型（运算语义约束） */
const allowedKinds = computed<TimeKind[]>(() => {
  if (!acc.value || !pendingOp.value) return ['clock', 'duration']
  if (acc.value.kind === 'duration') return ['duration']
  return pendingOp.value === '+' ? ['duration'] : ['clock', 'duration']
})
const kindLocked = computed(() => allowedKinds.value.length === 1)

/** 是否处于可输入状态：无累计值，或已有待运算符 */
const canInput = computed(() => !acc.value || !!pendingOp.value)
const opEnabled = computed(() => !!acc.value && !pendingOp.value)

const fmt = (t: TimeValue): string =>
  t.kind === 'clock' ? clockView(t.raw).text : durationView(t.raw)

const accViews = computed(() => (acc.value && !pendingOp.value && !buf.value ? dualViews(acc.value) : null))

/** 输入预览行：累计值 运算符 输入缓冲 */
const inputLine = computed(() => {
  const parts: string[] = []
  if (acc.value) parts.push(fmt(acc.value))
  if (pendingOp.value) parts.push(pendingOp.value === '+' ? '＋' : '－')
  if (buf.value || pendingOp.value || (!acc.value && !buf.value)) {
    parts.push(buf.value ? displayBuffer(buf.value) : '____')
  }
  return parts.join(' ')
})

const showHint = computed(() => !acc.value && !buf.value)

/* ---- 按键处理 ---- */
function pushError(msg: string) {
  error.value = msg
}

function commitBuf(): boolean {
  const v = commitBuffer(buf.value, inputKind.value)
  if (!v) {
    pushError(
      inputKind.value === 'clock' && buf.value.length === 4
        ? '时刻无效：小时 ≤23，分钟 ≤59'
        : buf.value.length < 4
          ? '请输入 4 位数字，如 1425 → 14:25'
          : '时长无效：分钟 ≤59'
    )
    return false
  }
  error.value = ''
  if (!acc.value) {
    acc.value = v
    buf.value = ''
    return true
  }
  if (pendingOp.value) {
    const r = applyOp(acc.value, pendingOp.value, v)
    if (!r) {
      pushError('该运算组合不合法')
      return false
    }
    const left = fmt(acc.value)
    const right = fmt(v)
    const views = dualViews(r)
    const resultStr =
      views.secondary && views.secondary.label === '累计'
        ? `${views.primary.text}${views.primary.note ? ` ${views.primary.note}` : ''}（累计 ${views.secondary.text}）`
        : views.secondary && views.secondary.label === '跨日读数'
          ? `${views.primary.text}（跨日 ${views.secondary.text}）`
          : views.secondary
            ? `${views.primary.text}（${views.secondary.label} ${views.secondary.text}）`
            : views.primary.text
    steps.value.push(`${left} ${pendingOp.value === '+' ? '＋' : '－'} ${right} ＝ ${resultStr}`)
    addHistory({
      expr: `${left} ${pendingOp.value === '+' ? '+' : '-'} ${right}`,
      primary: views.primary.text,
      primaryNote: views.primary.note,
      secondary: views.secondary?.text,
      ts: Date.now(),
    })
    history.value = loadHistory()
    acc.value = r
    pendingOp.value = null
    buf.value = ''
    return true
  }
  return false
}

function ensureKindAllowed(): void {
  const allowed = allowedKinds.value
  if (!allowed.includes(inputKind.value)) inputKind.value = allowed[0]
}

function onKey(k: string): void {
  if (k >= '0' && k <= '9') {
    if (!canInput.value) return
    error.value = ''
    ensureKindAllowed()
    const next = (buf.value + k).slice(0, 4)
    buf.value = next
    // 4 位且合法时自动提交（连续输入最快路径）
    if (next.length === 4 && commitBuffer(next, inputKind.value)) commitBuf()
    return
  }
  if (k === 'back') {
    buf.value = buf.value.slice(0, -1)
    error.value = ''
    return
  }
  if (k === 'clear') {
    buf.value = ''
    error.value = ''
    return
  }
  if (k === 'ok') {
    if (buf.value) commitBuf()
    return
  }
  if (k === 'add' || k === 'sub') {
    if (!acc.value) {
      if (buf.value) commitBuf()
      if (!acc.value) return
    } else if (buf.value && pendingOp.value) {
      commitBuf()
    }
    const op: Op = k === 'add' ? '+' : '-'
    if (acc.value && !pendingOp.value) {
      pendingOp.value = op
      buf.value = ''
      ensureKindAllowed()
    }
  }
}

function setKind(kind: TimeKind): void {
  if (!allowedKinds.value.includes(kind)) return
  inputKind.value = kind
}

function resetAll(): void {
  acc.value = null
  pendingOp.value = null
  buf.value = ''
  steps.value = []
  error.value = ''
  inputKind.value = 'clock'
}

function doClearHistory(): void {
  clearHistory()
  history.value = []
}

const fmtTime = (ts: number): string => {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
</script>

<template>
  <view class="page at-page" :class="themeClass">
    <!-- 步骤链 -->
    <view v-if="steps.length" class="steps">
      <text class="steps-title">计算链</text>
      <view v-for="(s, i) in steps" :key="i" class="step-line">
        <text>{{ s }}</text>
      </view>
      <view class="reset-btn" @tap="resetAll">
        <text>清空计算</text>
      </view>
    </view>

    <!-- 主显示区 -->
    <view class="display">
      <template v-if="accViews">
        <view class="dual primary-row">
          <text class="view-label">{{ accViews.primary.label }}</text>
          <text class="primary-text">{{ accViews.primary.text }}</text>
          <text v-if="accViews.primary.note" class="note">{{ accViews.primary.note }}</text>
        </view>
        <view v-if="accViews.secondary" class="dual">
          <text class="view-label">{{ accViews.secondary.label }}</text>
          <text class="secondary-text">{{ accViews.secondary.text }}</text>
        </view>
      </template>
      <template v-else>
        <text class="input-line">{{ inputLine }}</text>
        <view class="kind-chips">
          <view
            class="chip"
            :class="{ active: inputKind === 'clock', disabled: kindLocked && inputKind !== 'clock' }"
            @tap="setKind('clock')"
          >
            <text>时刻</text>
          </view>
          <view
            class="chip"
            :class="{ active: inputKind === 'duration', disabled: kindLocked && inputKind !== 'duration' }"
            @tap="setKind('duration')"
          >
            <text>时长</text>
          </view>
        </view>
        <text v-if="showHint" class="hint">连续输入数字自动格式化，如 1425 → 14:25</text>
        <text v-else-if="!canInput" class="hint">请选择 ＋ 或 － 继续运算，或清空重新开始</text>
      </template>
      <text v-if="error" class="error">{{ error }}</text>
    </view>

    <NumKeypad :op-enabled="opEnabled" @key="onKey" />

    <!-- 历史记录（可折叠） -->
    <view class="history">
      <view class="history-head" @tap="historyOpen = !historyOpen">
        <text class="history-title">历史记录（{{ history.length }}）</text>
        <view class="history-actions">
          <text v-if="historyOpen && history.length" class="history-clear" @tap.stop="doClearHistory">清空</text>
          <text class="history-toggle">{{ historyOpen ? '收起 ▲' : '展开 ▼' }}</text>
        </view>
      </view>
      <view v-if="historyOpen">
        <view v-if="!history.length" class="history-empty">
          <text>暂无记录</text>
        </view>
        <view v-for="(h, i) in history" :key="i" class="history-item">
          <view class="hi-main">
            <text class="hi-expr">{{ h.expr }}</text>
            <text class="hi-result">
              {{ h.primary }}{{ h.primaryNote ? ` ${h.primaryNote}` : '' }}{{ h.secondary ? `（跨日 ${h.secondary}）` : '' }}
            </text>
          </view>
          <text class="hi-ts">{{ fmtTime(h.ts) }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx 32rpx 48rpx;
  display: flex;
  flex-direction: column;
}
.steps {
  background: var(--at-card);
  border-radius: 20rpx;
  padding: 20rpx 28rpx;
  box-shadow: var(--at-shadow);
}
.steps-title {
  font-size: 24rpx;
  color: var(--at-weak);
}
.step-line {
  padding: 8rpx 0;
  font-size: 26rpx;
  color: var(--at-sub);
  border-bottom: 1rpx dashed var(--at-border);
}
.step-line:last-of-type {
  border-bottom: none;
}
.reset-btn {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--at-danger);
  text-align: right;
}

.display {
  margin-top: 24rpx;
  background: var(--at-card);
  border-radius: 28rpx;
  padding: 40rpx 36rpx;
  box-shadow: var(--at-shadow);
  min-height: 240rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 14rpx;
}
.dual {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
}
.primary-row {
  gap: 20rpx;
}
.view-label {
  font-size: 24rpx;
  color: var(--at-weak);
  min-width: 96rpx;
}
.primary-text {
  font-size: 96rpx;
  font-weight: 700;
  color: var(--at-text);
  font-variant-numeric: tabular-nums;
}
.secondary-text {
  font-size: 44rpx;
  font-weight: 600;
  color: var(--at-sub);
}
.note {
  font-size: 28rpx;
  color: var(--at-primary);
  font-weight: 600;
}
.input-line {
  font-size: 72rpx;
  font-weight: 700;
  color: var(--at-text);
  font-variant-numeric: tabular-nums;
}
.kind-chips {
  display: flex;
  gap: 16rpx;
  margin-top: 4rpx;
}
.chip {
  padding: 8rpx 28rpx;
  border-radius: 999rpx;
  background: var(--at-card-2);
  color: var(--at-sub);
  font-size: 26rpx;
}
.chip.active {
  background: var(--at-primary);
  color: var(--at-primary-contrast);
}
.chip.disabled {
  opacity: 0.35;
}
.hint {
  font-size: 24rpx;
  color: var(--at-weak);
}
.error {
  font-size: 24rpx;
  color: var(--at-danger);
}

.history {
  margin-top: 32rpx;
  background: var(--at-card);
  border-radius: 20rpx;
  padding: 8rpx 28rpx;
  box-shadow: var(--at-shadow);
}
.history-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
}
.history-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--at-text);
}
.history-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.history-clear {
  font-size: 24rpx;
  color: var(--at-danger);
}
.history-toggle {
  font-size: 24rpx;
  color: var(--at-weak);
}
.history-empty {
  padding: 16rpx 0 24rpx;
  font-size: 24rpx;
  color: var(--at-weak);
}
.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-top: 1rpx solid var(--at-border);
}
.hi-main {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.hi-expr {
  font-size: 26rpx;
  color: var(--at-text);
}
.hi-result {
  font-size: 24rpx;
  color: var(--at-sub);
}
.hi-ts {
  font-size: 22rpx;
  color: var(--at-weak);
}
</style>
