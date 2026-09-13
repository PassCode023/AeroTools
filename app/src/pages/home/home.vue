<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { currentInfo, type DbInfo } from '../../utils/db'
import { useTheme, syncNavBar } from '../../utils/theme'

// 声明后右上角胶囊菜单才出现"转发给朋友/分享到朋友圈"
onShareAppMessage(() => ({
  title: '航枢 AeroTools · 时间与航路，尽在掌握',
  path: '/pages/home/home',
}))
onShareTimeline(() => ({ title: '航枢 AeroTools · 时间与航路，尽在掌握' }))

const { themeClass } = useTheme()

const dbInfo = ref<DbInfo>({ version: '', count: 0, updatedAt: '', fromRemote: false })

// 自定义导航后内容顶到状态栏下：非 H5 端补状态栏 + 胶囊区高度（小程序胶囊约 44px）
const heroTop = ref(0)
// #ifndef H5
try {
  const sys = uni.getSystemInfoSync()
  // #ifdef MP-WEIXIN
  heroTop.value = (sys.statusBarHeight || 20) + 48
  // #endif
  // #ifdef APP-PLUS
  heroTop.value = (sys.statusBarHeight || 0) + 16
  // #endif
} catch {
  heroTop.value = 60
}
// #endif

onShow(() => {
  syncNavBar()
  // 每次回到首页实时刷新数据库信息（设置页更新后返回即见最新）
  dbInfo.value = currentInfo()
})

const updatedShort = computed(() => {
  const t = dbInfo.value.updatedAt
  return t.startsWith(String(new Date().getFullYear()) + '-') ? t.slice(5) : t
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
    <view class="hero" :style="heroTop ? { paddingTop: heroTop + 'px' } : {}">
      <view class="hero-nav">
        <view class="gear-btn" aria-label="设置" @tap="goSettings"></view>
      </view>
      <view class="brand">
        <image class="brand-logo" src="/static/logo.png" mode="aspectFill" />
        <view class="brand-text">
          <text class="logo">AeroTools</text>
          <text class="subtitle">航枢</text>
        </view>
      </view>
      <view class="hero-badge">
        <text>时间与航路，尽在掌握</text>
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
        <text class="db-version">{{ dbInfo.version }}</text>
      </view>
      <view class="db-row sub">
        <text class="db-sub">{{ dbInfo.count }} 家机场 · 更新于 {{ updatedShort }}</text>
        <text class="db-sub offline">离线可用</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 0 32rpx 48rpx;
  display: flex;
  flex-direction: column;
}
.hero {
  margin: 0 -32rpx;
  padding: 40rpx 48rpx 88rpx;
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
.hero-nav {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8rpx;
  position: relative;
  z-index: 1;
}
.gear-btn {
  width: 72rpx;
  height: 72rpx;
  margin: -12rpx -12rpx 0 0;
  background-image: url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAyNCAyNCcgZmlsbD0nd2hpdGUnPjxwYXRoIGQ9J00xOS4xNCAxMi45NGMuMDQtLjMuMDYtLjYxLjA2LS45NCAwLS4zMi0uMDItLjY0LS4wNy0uOTRsMi4wMy0xLjU4Yy4xOC0uMTQuMjMtLjQxLjEyLS42MWwtMS45Mi0zLjMyYy0uMTItLjIyLS4zNy0uMjktLjU5LS4yMmwtMi4zOS45NmMtLjUtLjM4LTEuMDMtLjctMS42Mi0uOTRMMTQuNCAyLjgxYy0uMDQtLjI0LS4yNC0uNDEtLjQ4LS40MWgtMy44NGMtLjI0IDAtLjQzLjE3LS40Ny40MUw5LjI1IDUuMzVDOC42NiA1LjU5IDguMTIgNS45MiA3LjYzIDYuMjlMNS4yNCA1LjMzYy0uMjItLjA4LS40NyAwLS41OS4yMkwyLjc0IDguODdjLS4xMi4yMS0uMDguNDcuMTIuNjFsMi4wMyAxLjU4Yy0uMDUuMy0uMDkuNjMtLjA5Ljk0cy4wMi42NC4wNy45NGwtMi4wMyAxLjU4Yy0uMTguMTQtLjIzLjQxLS4xMi42MWwxLjkyIDMuMzJjLjEyLjIyLjM3LjI5LjU5LjIybDIuMzktLjk2Yy41LjM4IDEuMDMuNyAxLjYyLjk0bC4zNiAyLjU0Yy4wNS4yNC4yNC40MS40OC40MWgzLjg0Yy4yNCAwIC40NC0uMTcuNDctLjQxbC4zNi0yLjU0Yy41OS0uMjQgMS4xMy0uNTYgMS42Mi0uOTRsMi4zOS45NmMuMjIuMDguNDcgMCAuNTktLjIybDEuOTItMy4zMmMuMTItLjIyLjA3LS40Ny0uMTItLjYxbC0yLjAxLTEuNTh6TTEyIDE1LjZjLTEuOTggMC0zLjYtMS42Mi0zLjYtMy42czEuNjItMy42IDMuNi0zLjYgMy42IDEuNjIgMy42IDMuNi0xLjYyIDMuNi0zLjYgMy42eicvPjwvc3ZnPg==);
  background-position: center;
  background-size: 44rpx 44rpx;
  background-repeat: no-repeat;
}
.brand {
  display: flex;
  align-items: center;
  gap: 24rpx;
  position: relative;
  z-index: 1;
}
.brand-logo {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  /* 白色描边让云天底图成为徽章面，在深色渐变上形成正式徽章感 */
  border: 4rpx solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 6rpx 20rpx rgba(15, 23, 42, 0.28);
  background: #bae3f5;
}
.brand-text {
  display: flex;
  flex-direction: column;
}
.logo {
  font-size: 68rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 2rpx;
  position: relative;
  z-index: 1;
}
.subtitle {
  margin-top: 10rpx;
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.85);
  position: relative;
  z-index: 1;
}
.hero-badge {
  margin-top: 28rpx;
  align-self: flex-start;
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-size: 24rpx;
  position: relative;
  z-index: 1;
}

.entries {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: -48rpx;
  margin-bottom: 32rpx;
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
  margin-top: auto;
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
.db-sub.offline {
  color: var(--at-success);
}
</style>
