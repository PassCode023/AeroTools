<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import {
  type TimeValue,
  type TimeKind,
  clockView,
  durationView,
  dualViews,
  displayBuffer,
} from '../../utils/timeMath'
import {
  freshState,
  pressKey,
  canInput,
  opEnabled,
  allowedKinds,
} from '../../utils/calcInput'
import { loadHistory, addHistory, clearHistory, type HistoryEntry } from '../../utils/calcHistory'
import { useTheme, syncNavBar } from '../../utils/theme'
import NumKeypad from '../../components/num-keypad.vue'

// 声明后右上角胶囊菜单才出现"转发给朋友/分享到朋友圈"
onShareAppMessage(() => ({
  title: '航枢 · 航班时刻加减，多步连续运算',
  path: '/pages/time-calc/time-calc',
}))
onShareTimeline(() => ({ title: '航枢 · 航班时刻加减，多步连续运算' }))

const { themeClass } = useTheme()

/* ---- 计算链状态（纯函数状态机见 utils/calcInput，P0-1 修复：任意状态可退格/C 恢复） ---- */
const state = ref(freshState())
const steps = ref<string[]>([])

/* ---- 历史记录 ---- */
const historyOpen = ref(false)
const history = ref<HistoryEntry[]>([])

onShow(() => {
  syncNavBar()
  history.value = loadHistory()
})

const kindList = computed<TimeKind[]>(() => allowedKinds(state.value))
const kindLocked = computed(() => kindList.value.length === 1)
const canInputNow = computed(() => canInput(state.value))
const opEnabledNow = computed(() => opEnabled(state.value))

const fmt = (t: TimeValue): string =>
  t.kind === 'clock' ? clockView(t.raw).text : durationView(t.raw)

const accViews = computed(() =>
  state.value.acc && !state.value.pendingOp && !state.value.buf ? dualViews(state.value.acc) : null
)

/** 输入预览行：累计值 运算符 输入缓冲 */
const inputLine = computed(() => {
  const parts: string[] = []
  if (state.value.acc) parts.push(fmt(state.value.acc))
  if (state.value.pendingOp) parts.push(state.value.pendingOp === '+' ? '＋' : '－')
  if (state.value.buf || state.value.pendingOp || (!state.value.acc && !state.value.buf)) {
    parts.push(state.value.buf ? displayBuffer(state.value.buf) : '____')
  }
  return parts.join(' ')
})

const showHint = computed(() => !state.value.acc && !state.value.buf)

const errorText = computed(() => {
  switch (state.value.error) {
    case 'incomplete':
      return '请输入 4 位数字，如 1425 → 14:25'
    case 'invalidClock':
      return '时刻无效：小时 ≤23，分钟 ≤59'
    case 'invalidDuration':
      return '时长无效：分钟 ≤59'
    case 'badOp':
      return '该运算组合不合法'
    default:
      return ''
  }
})

/* ---- 按键处理：状态流转在 calcInput，这里只消费事件（计算链/历史属视图副作用） ---- */
function onKey(k: string): void {
  const { state: next, event } = pressKey(state.value, k)
  state.value = next
  if (!event || event.type !== 'computed') return
  const { op, left, right, result } = event.ev
  const views = dualViews(result)
  const resultStr =
    views.secondary && views.secondary.label === '累计'
      ? `${views.primary.text}${views.primary.note ? ` ${views.primary.note}` : ''}（累计 ${views.secondary.text}）`
      : views.secondary && views.secondary.label === '跨日读数'
        ? `${views.primary.text}（跨日 ${views.secondary.text}）`
        : views.secondary
          ? `${views.primary.text}（${views.secondary.label} ${views.secondary.text}）`
          : views.primary.text
  steps.value.push(`${fmt(left)} ${op === '+' ? '＋' : '－'} ${fmt(right)} ＝ ${resultStr}`)
  addHistory({
    expr: `${fmt(left)} ${op === '+' ? '+' : '-'} ${fmt(right)}`,
    primary: views.primary.text,
    primaryNote: views.primary.note,
    secondary: views.secondary?.text,
    ts: Date.now(),
  })
  history.value = loadHistory()
}

function setKind(kind: TimeKind): void {
  if (!kindList.value.includes(kind)) return
  state.value = { ...state.value, inputKind: kind }
}

function resetAll(): void {
  state.value = freshState()
  steps.value = []
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
      <button class="reset-btn" @tap="resetAll">
        <text>清空计算</text>
      </button>
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
          <button
            class="chip"
            :class="{ active: state.inputKind === 'clock', disabled: kindLocked && state.inputKind !== 'clock' }"
            @tap="setKind('clock')"
          >
            <text>时刻</text>
          </button>
          <button
            class="chip"
            :class="{ active: state.inputKind === 'duration', disabled: kindLocked && state.inputKind !== 'duration' }"
            @tap="setKind('duration')"
          >
            <text>时长</text>
          </button>
        </view>
        <text v-if="showHint" class="hint">连续输入数字自动格式化，如 1425 → 14:25</text>
        <text v-else-if="!canInputNow" class="hint">请选择 ＋ 或 － 继续运算，或按 ⌫ 修改、C 清空重来</text>
      </template>
      <text v-if="errorText" class="error">{{ errorText }}</text>
    </view>

    <NumKeypad :op-enabled="opEnabledNow" @key="onKey" />

    <!-- 历史记录（可折叠） -->
    <view class="history">
      <view class="history-head">
        <button class="history-title-btn" @tap="historyOpen = !historyOpen">
          <text class="history-title">历史记录（{{ history.length }}）</text>
        </button>
        <view class="history-actions">
          <button v-if="historyOpen && history.length" class="history-clear" @tap.stop="doClearHistory">
            <text>清空</text>
          </button>
          <button class="history-toggle" @tap="historyOpen = !historyOpen">
            <text>{{ historyOpen ? '收起 ▲' : '展开 ▼' }}</text>
          </button>
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
  margin-left: auto;
  min-height: 72rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  background-color: transparent;
  font-size: 26rpx;
  color: var(--at-danger);
  font-weight: 600;
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
  min-height: 88rpx;
  padding: 0 36rpx;
  display: flex;
  align-items: center;
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
  padding: 8rpx 0;
}
.history-title-btn {
  flex: 1;
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  background-color: transparent;
  text-align: left;
}
.history-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--at-text);
}
.history-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.history-clear {
  min-height: 72rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  background-color: transparent;
  font-size: 24rpx;
  color: var(--at-danger);
  font-weight: 600;
}
.history-toggle {
  min-height: 72rpx;
  padding: 0 8rpx;
  display: flex;
  align-items: center;
  background-color: transparent;
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
  font-size: 24rpx;
  color: var(--at-weak);
}
</style>
