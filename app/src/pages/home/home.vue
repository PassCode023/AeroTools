<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { loadDb, currentVersion } from '../../utils/db'
import { useTheme, syncNavBar } from '../../utils/theme'

const { themeClass } = useTheme()

const dbVersion = ref('')
const dbCount = ref(0)

onShow(() => {
  syncNavBar()
  dbVersion.value = currentVersion()
  dbCount.value = loadDb().length
})

function goTimeCalc() {
  uni.navigateTo({ url: '/pages/time-calc/time-calc' })
}
function goAirportSearch() {
  uni.navigateTo({ url: '/pages/airport-search/airport-search' })
}
function goSettings() {
  uni.navigateTo({ url: '/pages/settings/settings' })
}
</script>

<template>
  <view class="page at-page" :class="themeClass">
    <view class="hero">
      <text class="logo">AeroTools</text>
      <text class="subtitle">民航工具箱</text>
      <view class="hero-badge">
        <text>离线可用 · 飞行前准备</text>
      </view>
    </view>

    <view class="entries">
      <view class="entry" @tap="goTimeCalc">
        <view class="entry-icon">
          <text>🕒</text>
        </view>
        <view class="entry-text">
          <text class="entry-title">时间计算</text>
          <text class="entry-desc">时刻与时长加减 · 多步连续运算</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>

      <view class="entry" @tap="goAirportSearch">
        <view class="entry-icon green">
          <text>🛫</text>
        </view>
        <view class="entry-text">
          <text class="entry-title">机场查询</text>
          <text class="entry-desc">IATA / ICAO / 中文名 / 城市</text>
        </view>
        <text class="entry-arrow">›</text>
      </view>
    </view>

    <view class="db-card" @tap="goSettings">
      <view class="db-row">
        <text class="db-label">机场数据库</text>
        <text class="db-version">{{ dbVersion }}</text>
      </view>
      <view class="db-row sub">
        <text class="db-sub">{{ dbCount }} 家机场 · 离线可用</text>
        <text class="db-sub">更新与设置 ›</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 0 32rpx 48rpx;
}
.hero {
  margin: 0 -32rpx;
  padding: 72rpx 48rpx 88rpx;
  background: var(--at-hero-grad);
  border-radius: 0 0 48rpx 48rpx;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
/* uiverse 风格的柔光装饰 */
.hero::after {
  content: '';
  position: absolute;
  right: -120rpx;
  top: -120rpx;
  width: 420rpx;
  height: 420rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.12);
}
.logo {
  font-size: 68rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
}
.subtitle {
  margin-top: 10rpx;
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.85);
}
.hero-badge {
  margin-top: 28rpx;
  align-self: flex-start;
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-size: 24rpx;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: -48rpx;
  position: relative;
  z-index: 1;
}
.entry {
  display: flex;
  align-items: center;
  padding: 36rpx 32rpx;
  gap: 24rpx;
  background: var(--at-card);
  border-radius: 28rpx;
  box-shadow: var(--at-shadow);
  border: 1rpx solid var(--at-border);
}
.entry:active {
  transform: scale(0.98);
}
.entry-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  background: var(--at-primary-soft);
}
.entry-icon.green {
  background: var(--at-success-soft);
}
.entry-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.entry-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--at-text);
}
.entry-desc {
  font-size: 24rpx;
  color: var(--at-weak);
}
.entry-arrow {
  font-size: 48rpx;
  color: var(--at-weak);
}

.db-card {
  margin-top: 32rpx;
  padding: 28rpx 32rpx;
  background: var(--at-card);
  border-radius: 24rpx;
  box-shadow: var(--at-shadow);
}
.db-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.db-row.sub {
  margin-top: 10rpx;
}
.db-label {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--at-text);
}
.db-version {
  font-size: 28rpx;
  color: var(--at-primary);
  font-weight: 600;
}
.db-sub {
  font-size: 24rpx;
  color: var(--at-weak);
}
</style>
