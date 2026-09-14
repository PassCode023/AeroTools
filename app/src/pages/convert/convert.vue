<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { CATEGORIES, convert, type CategoryId } from '../../utils/unitConvert'
import { useTheme, syncNavBar } from '../../utils/theme'
import { onShow } from '@dcloudio/uni-app'

// 声明后右上角胶囊菜单才出现"转发给朋友/分享到朋友圈"
onShareAppMessage(() => ({
  title: '航枢 · 离线单位换算（ft/m · NM/km · kt · inHg/hPa）',
  path: '/pages/convert/convert',
}))
onShareTimeline(() => ({ title: '航枢 · 离线单位换算' }))

const { themeClass } = useTheme()
onShow(() => {
  syncNavBar()
})

const catId = ref<CategoryId>('length')
const cat = computed(() => CATEGORIES.find((c) => c.id === catId.value)!)
const leftVal = ref('')
const rightVal = ref('')

// 分类切换后清空两侧（不得跨类别复用旧结果）
function pick(id: CategoryId) {
  catId.value = id
  leftVal.value = ''
  rightVal.value = ''
}

// uni 原生输入框手动绑定：编辑一侧即时更新另一侧；
// 无效/空输入 → 对侧清空（不回退显示上一次结果）
function onLeftInput(e: { detail: { value: string } } | Event) {
  leftVal.value = (e as { detail: { value: string } }).detail?.value ?? ''
  rightVal.value = convert(catId.value, leftVal.value, 'forward') ?? ''
}
function onRightInput(e: { detail: { value: string } } | Event) {
  rightVal.value = (e as { detail: { value: string } }).detail?.value ?? ''
  leftVal.value = convert(catId.value, rightVal.value, 'reverse') ?? ''
}

/** 公式提示行 */
const formula = computed(() => {
  switch (catId.value) {
    case 'length':
      return '1 ft = 0.3048 m'
    case 'distance':
      return '1 NM = 1.852 km'
    case 'speed':
      return '1 kt = 1.852 km/h'
    case 'pressure':
      return '1 inHg = 33.8638866667 hPa'
    case 'mass':
      return '1 lb = 0.45359237 kg'
    case 'temperature':
      return '°F = °C × 9/5 + 32'
  }
})

const negativeHint = computed(() => !cat.value.allowNegative)
</script>

<template>
  <view class="page at-page" :class="themeClass">
    <scroll-view class="chips" scroll-x :show-scrollbar="false">
      <button
        v-for="c in CATEGORIES"
        :key="c.id"
        class="chip"
        :class="{ active: c.id === catId }"
        @tap="pick(c.id)"
      >
        {{ c.label }}
      </button>
    </scroll-view>

    <view class="board">
      <view class="row">
        <input
          class="num"
          type="digit"
          :value="leftVal"
          placeholder="0"
          placeholder-class="ph"
          :maxlength="16"
          @input="onLeftInput"
        />
        <text class="unit">{{ cat.left }}</text>
      </view>

      <view class="eq">
        <text class="eq-line">=</text>
      </view>

      <view class="row">
        <input
          class="num"
          type="digit"
          :value="rightVal"
          placeholder="0"
          placeholder-class="ph"
          :maxlength="16"
          @input="onRightInput"
        />
        <text class="unit">{{ cat.right }}</text>
      </view>
    </view>

    <view class="meta">
      <text class="formula">{{ formula }}</text>
      <text class="offline">离线计算 · 不访问网络</text>
      <text v-if="negativeHint" class="hint">除温度外不支持负数</text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx 32rpx 48rpx;
}
.chips {
  white-space: nowrap;
  margin-bottom: 28rpx;
}
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 128rpx;
  height: 72rpx;
  margin-right: 16rpx;
  padding: 0 28rpx;
  border-radius: 999rpx;
  background: var(--at-card);
  color: var(--at-sub);
  font-size: 28rpx;
  border: 1rpx solid var(--at-border);
}
.chip.active {
  background: var(--at-primary);
  color: var(--at-primary-contrast);
  border-color: var(--at-primary);
  font-weight: 700;
}

.board {
  background: var(--at-card);
  border-radius: 28rpx;
  box-shadow: var(--at-shadow);
  padding: 20rpx 32rpx;
}
.row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 0;
}
.eq {
  display: flex;
  align-items: center;
  justify-content: center;
}
.eq-line {
  color: var(--at-weak);
  font-size: 32rpx;
}
.num {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 52rpx;
  font-weight: 700;
  color: var(--at-text);
}
.unit {
  min-width: 110rpx;
  text-align: left;
  font-size: 32rpx;
  font-weight: 600;
  color: var(--at-primary);
}
.ph {
  color: var(--at-weak);
  font-weight: 400;
}

.meta {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  align-items: center;
}
.formula {
  font-size: 28rpx;
  color: var(--at-sub);
  font-weight: 600;
}
.offline {
  font-size: 24rpx;
  color: var(--at-success);
}
.hint {
  font-size: 24rpx;
  color: var(--at-weak);
}
</style>
