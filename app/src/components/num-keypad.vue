<script setup lang="ts">
const props = defineProps<{ opEnabled: boolean }>()
const emit = defineEmits<{ (e: 'key', k: string): void }>()
</script>

<template>
  <view class="pad">
    <button class="key" @tap="emit('key', '7')">7</button>
    <button class="key" @tap="emit('key', '8')">8</button>
    <button class="key" @tap="emit('key', '9')">9</button>
    <button class="key fn" aria-label="退格删除末位" @tap="emit('key', 'back')">⌫</button>

    <button class="key" @tap="emit('key', '4')">4</button>
    <button class="key" @tap="emit('key', '5')">5</button>
    <button class="key" @tap="emit('key', '6')">6</button>
    <button class="key fn" aria-label="清空重算" @tap="emit('key', 'clear')">C</button>

    <button class="key" @tap="emit('key', '1')">1</button>
    <button class="key" @tap="emit('key', '2')">2</button>
    <button class="key" @tap="emit('key', '3')">3</button>
    <button class="key" @tap="emit('key', '0')">0</button>

    <button
      class="key op span2"
      :class="{ disabled: !props.opEnabled }"
      :disabled="!props.opEnabled"
      aria-label="加"
      @tap="props.opEnabled && emit('key', 'add')"
    >＋</button>
    <button
      class="key op span2"
      :class="{ disabled: !props.opEnabled }"
      :disabled="!props.opEnabled"
      aria-label="减"
      @tap="props.opEnabled && emit('key', 'sub')"
    >－</button>
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
  width: 100%;
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
  line-height: 1;
}
.key:active {
  background: var(--at-primary-soft);
}
.key.fn {
  background: var(--at-card-2);
  color: var(--at-sub);
  font-size: 38rpx;
}
.key.op {
  background: var(--at-primary-soft);
  color: var(--at-primary);
}
.key.op.disabled,
.key.op[disabled] {
  opacity: 0.35;
}
.key.span2 {
  grid-column: span 2;
}
</style>
