<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { searchAirports, type Airport } from '../../utils/airportSearch'
import { loadDb } from '../../utils/db'
import { useTheme, syncNavBar } from '../../utils/theme'

const { themeClass } = useTheme()

const query = ref('')
const expandedKey = ref('')
const db = ref<Airport[]>([])

onShow(() => {
  syncNavBar()
  db.value = loadDb()
})

let timer: ReturnType<typeof setTimeout> | null = null
// uni 原生输入框没有 vue 双绑细节问题，手动绑定 + 轻量防抖（问卷 Q14：边输入边匹配）
const results = ref<Airport[]>([])
function onInput(e: { detail: { value: string } } | Event) {
  const v = (e as { detail: { value: string } }).detail?.value ?? ''
  query.value = v
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    results.value = searchAirports(db.value, query.value, 50)
  }, 120)
}
function clearQuery() {
  query.value = ''
  results.value = []
}

const showResults = computed(() => query.value.trim().length > 0)

function toggleDetail(a: Airport) {
  const key = `${a.iata}|${a.icao}`
  expandedKey.value = expandedKey.value === key ? '' : key
}
const fmtCoord = (v: number, pos: string, neg: string): string =>
  `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`
</script>

<template>
  <view class="page at-page" :class="themeClass">
    <view class="search-box">
      <text class="search-icon">🔍</text>
      <input
        class="search-input"
        type="text"
        :value="query"
        placeholder="IATA / ICAO / 机场名 / 城市"
        placeholder-class="ph"
        confirm-type="search"
        @input="onInput"
      />
      <text v-if="query" class="search-clear" @tap="clearQuery">✕</text>
    </view>

    <view v-if="!showResults" class="empty">
      <text class="empty-icon">🛫</text>
      <text class="empty-text">输入代码、机场名或城市名开始查询</text>
      <text class="empty-sub">如 PEK、ZBAA、首都、北京</text>
    </view>

    <view v-else-if="!results.length" class="empty">
      <text class="empty-icon">🧭</text>
      <text class="empty-text">未找到匹配的机场</text>
      <text class="empty-sub">试试其他代码或名称</text>
    </view>

    <view v-else class="list">
      <view
        v-for="a in results"
        :key="`${a.iata}|${a.icao}`"
        class="item"
        @tap="toggleDetail(a)"
      >
        <view class="item-main">
          <view class="codes">
            <text class="iata">{{ a.iata || '—' }}</text>
            <text class="icao">{{ a.icao || '—' }}</text>
          </view>
          <view class="names">
            <text class="name">{{ a.nameZh }}</text>
            <text class="city">{{ a.cityZh }} · {{ a.country }}</text>
          </view>
        </view>
        <view v-if="expandedKey === `${a.iata}|${a.icao}`" class="detail">
          <view v-if="a.nameEn" class="d-row">
            <text class="d-label">英文名</text>
            <text class="d-value">{{ a.nameEn }}</text>
          </view>
          <view class="d-row">
            <text class="d-label">坐标</text>
            <text class="d-value">{{ fmtCoord(a.lat, 'N', 'S') }}，{{ fmtCoord(a.lng, 'E', 'W') }}</text>
          </view>
          <view class="d-row">
            <text class="d-label">时区</text>
            <text class="d-value">{{ a.tz }}</text>
          </view>
          <view v-if="a.elevM !== undefined" class="d-row">
            <text class="d-label">海拔</text>
            <text class="d-value">{{ a.elevM }} 米</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  padding: 24rpx 32rpx 48rpx;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: var(--at-card);
  border-radius: 999rpx;
  padding: 20rpx 28rpx;
  box-shadow: var(--at-shadow);
}
.search-icon {
  font-size: 30rpx;
}
.search-input {
  flex: 1;
  font-size: 30rpx;
  color: var(--at-text);
}
.ph {
  color: var(--at-weak);
}
.search-clear {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--at-card-2);
  color: var(--at-sub);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

.empty {
  margin-top: 160rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.empty-icon {
  font-size: 80rpx;
}
.empty-text {
  font-size: 30rpx;
  color: var(--at-sub);
}
.empty-sub {
  font-size: 24rpx;
  color: var(--at-weak);
}

.list {
  margin-top: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.item {
  background: var(--at-card);
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: var(--at-shadow);
  border: 1rpx solid var(--at-border);
}
.item-main {
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.codes {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 120rpx;
}
.iata {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--at-primary);
  letter-spacing: 2rpx;
}
.icao {
  font-size: 22rpx;
  color: var(--at-weak);
  letter-spacing: 1rpx;
}
.names {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--at-text);
}
.city {
  font-size: 24rpx;
  color: var(--at-sub);
}
.detail {
  margin-top: 20rpx;
  padding-top: 20rpx;
  border-top: 1rpx dashed var(--at-border);
}
.d-row {
  display: flex;
  gap: 24rpx;
  padding: 6rpx 0;
}
.d-label {
  width: 110rpx;
  font-size: 24rpx;
  color: var(--at-weak);
}
.d-value {
  flex: 1;
  font-size: 24rpx;
  color: var(--at-text);
}
</style>
