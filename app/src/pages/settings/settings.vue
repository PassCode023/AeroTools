<script setup lang="ts">
import { onShow, onShareAppMessage, onShareTimeline } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { currentInfo, bundledInfo, type DbInfo } from '../../utils/db'
import { checkAndPrompt, type UpdateStatus } from '../../utils/updater'
import { APP_VERSION, FEEDBACK_URL, DB_UPDATE_BASE_URL } from '../../config'
import { useTheme, syncNavBar, type ThemeMode } from '../../utils/theme'

// 声明后右上角胶囊菜单才出现"转发给朋友/分享到朋友圈"
onShareAppMessage(() => ({
  title: '航枢 AeroTools · 面向大众的航空查询工具集',
  path: '/pages/home/home',
}))
onShareTimeline(() => ({ title: '航枢 AeroTools · 面向大众的航空查询工具集' }))

const { themeClass, mode, setTheme } = useTheme()

const dbInfo = ref<DbInfo>({ version: '', count: 0, updatedAt: '', fromRemote: false })
const bundledVer = bundledInfo()

// 评审 P0-3：更新服务未配置时不展示任何可点击的更新入口
const updateConfigured = !!DB_UPDATE_BASE_URL

const status = ref<UpdateStatus>({ state: 'idle' })
const checking = computed(() => status.value.state === 'checking' || status.value.state === 'downloading')

/** 数据来源（v1.0.2：结构化三来源，展示名称与用途；完整地址见项目仓库 SOURCES.md） */
const sourceRows = computed(() => dbInfo.value.sources || [])

/** 境内运输机场覆盖（民航局名录对账结果） */
const coverageText = computed(() => {
  const c = dbInfo.value.coverage
  return c ? `${c.matched}/${c.expected}（截至 ${c.asOf}）` : ''
})

/** 复制反馈地址（小程序端的主要留言路径） */
function copyFeedback(): void {
  uni.setClipboardData({
    data: FEEDBACK_URL,
    success: () => {
      // #ifndef MP-WEIXIN
      uni.showToast({ title: '地址已复制', icon: 'success' })
      // #endif
    },
  })
}

/** 打开留言页：APP 用系统浏览器，H5 开新标签；小程序降级为复制地址 */
function openFeedback(): void {
  // #ifdef H5
  window.open(FEEDBACK_URL, '_blank')
  // #endif
  // #ifdef APP-PLUS
  ;(globalThis as { plus?: { runtime?: { openURL?: (u: string) => void } } }).plus?.runtime?.openURL?.(FEEDBACK_URL)
  // #endif
  // #ifdef MP-WEIXIN
  copyFeedback()
  uni.showToast({ title: '地址已复制，请在浏览器打开留言', icon: 'none' })
  // #endif
}

onShow(() => {
  syncNavBar()
  dbInfo.value = currentInfo()
})

async function manualCheck() {
  const s = await checkAndPrompt({
    onStatus: (st) => (status.value = st),
  })
  if (s.state === 'success') {
    dbInfo.value = currentInfo()
    uni.showToast({ title: `已更新到 ${s.version}`, icon: 'success' })
  }
}

const statusText = computed(() => {
  switch (status.value.state) {
    case 'checking':
      return '正在检查更新…'
    case 'up-to-date':
      return `已是最新版本（${status.value.version}）`
    case 'downloading':
      return '正在下载数据库…'
    case 'success':
      return `已更新到 ${status.value.version}`
    case 'error':
      return `更新失败：${status.value.message}`
    case 'not-configured':
      return '使用内置数据库'
    default:
      return dbInfo.value.fromRemote ? '已使用在线更新的数据库' : '使用内置数据库'
  }
})

function pickTheme(m: ThemeMode) {
  setTheme(m)
}
</script>

<template>
  <view class="page at-page" :class="themeClass">
    <!-- 外观 -->
    <view class="card section">
      <text class="card-title">外观</text>
      <view class="theme-switch">
        <button class="theme-opt" :class="{ active: mode === 'light' }" @tap="pickTheme('light')">
          <text>☀️ 浅色</text>
        </button>
        <button class="theme-opt" :class="{ active: mode === 'dark' }" @tap="pickTheme('dark')">
          <text>🌙 深色</text>
        </button>
      </view>
    </view>

    <!-- 机场数据库 -->
    <view class="card section">
      <text class="card-title">机场数据库</text>
      <view class="info-row">
        <text class="info-label">当前版本</text>
        <text class="info-value">{{ dbInfo.version }}{{ dbInfo.fromRemote ? '（在线更新）' : '' }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">机场数量</text>
        <text class="info-value">{{ dbInfo.count }} 家</text>
      </view>
      <view v-if="coverageText" class="info-row">
        <text class="info-label">境内运输机场</text>
        <text class="info-value">{{ coverageText }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">资料截至</text>
        <text class="info-value">{{ dbInfo.dataAsOf || dbInfo.updatedAt }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">数据构建时间</text>
        <text class="info-value">{{ dbInfo.updatedAt }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">内置版本</text>
        <text class="info-value">{{ bundledVer.version }}（{{ bundledVer.count }} 家）</text>
      </view>
      <template v-if="updateConfigured">
        <view class="status-line">
          <text class="status-text">{{ statusText }}</text>
        </view>
        <button class="btn primary" :disabled="checking" @tap="manualCheck">
          {{ checking ? '处理中…' : '检查更新' }}
        </button>
        <text class="note">支持 Wi-Fi 与移动网络下载；更新前会提示确认，失败自动保留原数据库。</text>
      </template>
      <view class="note tight source-note">
        <text>数据来源：</text>
        <text v-for="s in sourceRows" :key="s.name" class="source-url">{{ s.name }} · {{ s.usage }}</text>
      </view>
    </view>

    <!-- 意见反馈 -->
    <view class="card section">
      <text class="card-title">意见反馈</text>
      <text class="note tight">使用中遇到问题，或有功能建议，欢迎留言告诉我们：</text>
      <view class="fb-url">
        <text class="fb-link">{{ FEEDBACK_URL }}</text>
        <button class="fb-copy" aria-label="复制反馈地址" @tap="copyFeedback">
          <text>复制</text>
        </button>
      </view>
      <button class="btn primary" @tap="openFeedback">打开留言页</button>
    </view>

    <!-- 关于 -->
    <view class="card section">
      <text class="card-title">关于</text>
      <view class="about-head">
        <image class="about-logo" src="/static/logo.png" mode="aspectFill" />
        <view class="about-name">
          <text class="about-title">AeroTools 航枢</text>
          <text class="about-slogan">时间与航路，尽在掌握</text>
        </view>
      </view>
      <view class="info-row">
        <text class="info-label">应用版本</text>
        <text class="info-value">{{ APP_VERSION }}</text>
      </view>
      <text class="note">
        AeroTools 航枢 · 面向大众的航空查询工具集。核心功能完全离线可用。
        本应用数据仅供参考，请以民航局及相关官方发布的航行资料为准。
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx 32rpx 48rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.card {
  background: var(--at-card);
  border-radius: 24rpx;
  padding: 32rpx;
  box-shadow: var(--at-shadow);
}
.card-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--at-text);
  margin-bottom: 20rpx;
  display: block;
}
.about-head {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-bottom: 24rpx;
}
.about-logo {
  width: 132rpx;
  height: 132rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--at-border);
  box-shadow: var(--at-shadow);
}
.about-name {
  display: flex;
  flex-direction: column;
}
.about-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--at-text);
}
.about-slogan {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--at-sub);
}
.theme-switch {
  display: flex;
  gap: 16rpx;
}
.theme-opt {
  flex: 1;
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  text-align: center;
  font-size: 28rpx;
  background: var(--at-card-2);
  color: var(--at-sub);
}
.theme-opt.active {
  background: var(--at-primary);
  color: var(--at-primary-contrast);
  font-weight: 600;
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
}
.info-label {
  font-size: 26rpx;
  color: var(--at-sub);
}
.info-value {
  font-size: 26rpx;
  color: var(--at-text);
  font-weight: 500;
}
.status-line {
  margin-top: 12rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: var(--at-card-2);
}
.status-text {
  font-size: 24rpx;
  color: var(--at-sub);
}
.btn.primary {
  margin-top: 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  font-size: 30rpx;
  font-weight: 600;
  background: var(--at-primary);
  color: var(--at-primary-contrast);
  border-radius: 999rpx;
}
.btn.primary[disabled] {
  opacity: 0.5;
  color: var(--at-primary-contrast);
  background: var(--at-primary);
}
.note {
  display: block;
  margin-top: 20rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: var(--at-weak);
}
.source-note {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.source-url {
  color: var(--at-primary);
  word-break: break-all;
}
.note.tight {
  margin-top: 0;
}
.fb-url {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  background: var(--at-card-2);
}
.fb-link {
  flex: 1;
  font-size: 24rpx;
  color: var(--at-primary);
  word-break: break-all;
}
.fb-copy {
  flex-shrink: 0;
  min-height: 72rpx;
  display: flex;
  align-items: center;
  background-color: transparent;
  font-size: 24rpx;
  color: var(--at-primary);
  font-weight: 600;
  padding: 0 24rpx;
  border: 2rpx solid var(--at-primary);
  border-radius: 999rpx;
}
</style>
