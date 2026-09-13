<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { checkAndPrompt } from './utils/updater'
import { applyNavBar } from './utils/theme'

onLaunch(() => {
  // 启动静默检查机场数据库更新：发现新版才弹窗询问（问卷 Q20），其余静默
  setTimeout(() => {
    checkAndPrompt({}, true)
  }, 2000)
  applyNavBar()
})
</script>

<style>
/* ===== 主题令牌（参考 uiverse/galaxy 双模式风格：渐变、大圆角、柔和阴影） ===== */
/* 每页根 view 绑定 .theme-light / .theme-dark，令牌从这里向下级联 */
.theme-light {
  --at-bg: #f5f7fa;
  --at-card: #ffffff;
  --at-card-2: #eef1f6;
  --at-text: #1f2937;
  --at-sub: #6b7280;
  --at-weak: #9ca3af;
  --at-border: #e5e7eb;
  --at-primary: #2456e6;
  --at-primary-contrast: #ffffff;
  --at-primary-soft: #e8eefc;
  --at-success: #16a34a;
  --at-success-soft: #e5f4ec;
  --at-danger: #dc2626;
  --at-danger-soft: #fdecec;
  --at-shadow: 0 2rpx 10rpx rgba(31, 41, 55, 0.06);
  --at-hero-grad: linear-gradient(135deg, #2456e6 0%, #6d3ae8 62%, #3b82f6 100%);
}
.theme-dark {
  --at-bg: #0f172a;
  --at-card: #1e293b;
  --at-card-2: #263349;
  --at-text: #e2e8f0;
  --at-sub: #94a3b8;
  --at-weak: #64748b;
  --at-border: #334155;
  --at-primary: #5b8cff;
  --at-primary-contrast: #ffffff;
  --at-primary-soft: #1e3a6e;
  --at-success: #4ade80;
  --at-success-soft: #143624;
  --at-danger: #f87171;
  --at-danger-soft: #3b1a1a;
  --at-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.35);
  --at-hero-grad: linear-gradient(135deg, #1d4ed8 0%, #5b21b6 62%, #1e40af 100%);
}

page {
  background: #f5f7fa;
  font-size: 28rpx;
}
view, text, input, button {
  box-sizing: border-box;
}

/* ===== 通用工具类（使用令牌，自动适配双主题） ===== */
.at-page {
  min-height: 100vh;
  background: var(--at-bg);
  color: var(--at-text);
  transition: background-color 0.25s, color 0.25s;
}
.at-card {
  background: var(--at-card);
  border-radius: 24rpx;
  box-shadow: var(--at-shadow);
}
.at-btn-primary {
  background: var(--at-primary);
  color: var(--at-primary-contrast);
  border-radius: 999rpx;
  text-align: center;
}
.at-btn-primary[disabled] {
  opacity: 0.5;
  color: var(--at-primary-contrast);
  background: var(--at-primary);
}
.at-btn-plain {
  background: var(--at-card);
  color: var(--at-primary);
  border: 2rpx solid var(--at-primary);
  border-radius: 999rpx;
  text-align: center;
}
</style>
