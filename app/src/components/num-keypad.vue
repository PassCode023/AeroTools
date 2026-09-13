<script setup lang="ts">
const props = defineProps<{ opEnabled: boolean }>()
const emit = defineEmits<{ (e: 'key', k: string): void }>()
</script>

<template>
  <view class="pad">
    <view class="key" @tap="emit('key', '7')">7</view>
    <view class="key" @tap="emit('key', '8')">8</view>
    <view class="key" @tap="emit('key', '9')">9</view>
    <view class="key fn" @tap="emit('key', 'back')">⌫</view>

    <view class="key" @tap="emit('key', '4')">4</view>
    <view class="key" @tap="emit('key', '5')">5</view>
    <view class="key" @tap="emit('key', '6')">6</view>
    <view class="key fn" @tap="emit('key', 'clear')">C</view>

    <view class="key" @tap="emit('key', '1')">1</view>
    <view class="key" @tap="emit('key', '2')">2</view>
    <view class="key" @tap="emit('key', '3')">3</view>
    <view class="key ok" @tap="emit('key', 'ok')">✓</view>

    <view class="key op" :class="{ disabled: !props.opEnabled }" @tap="props.opEnabled && emit('key', 'add')">＋</view>
    <view class="key op" :class="{ disabled: !props.opEnabled }" @tap="props.opEnabled && emit('key', 'sub')">－</view>
    <view class="key span2" @tap="emit('key', '0')">0</view>
  </view>
</template>

<style lang="scss" scoped>
.pad {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-top: 24rpx;
}
.key {
  height: 108rpx;
  border-radius: 18rpx;
  background: var(--at-card);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  font-weight: 600;
  color: var(--at-text);
  box-shadow: var(--at-shadow);
}
.key:active {
  background: var(--at-primary-soft);
}
.key.fn {
  background: var(--at-card-2);
  color: var(--at-sub);
  font-size: 38rpx;
}
.key.ok {
  background: var(--at-primary);
  color: var(--at-primary-contrast);
}
.key.op {
  background: var(--at-primary-soft);
  color: var(--at-primary);
}
.key.op.disabled {
  opacity: 0.35;
}
.key.span2 {
  grid-column: span 2;
}
</style>
