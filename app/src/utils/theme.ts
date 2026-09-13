/**
 * 主题（浅色/深色）跨页共享状态。
 * 实现方式：每页根 view 绑定 theme-light / theme-dark 类，
 * App.vue 中定义两套 CSS 变量令牌（参考 uiverse galaxy 组件的双模式风格）。
 */
import { ref, computed } from 'vue'
import { getItem, setItem } from './storage'

export type ThemeMode = 'light' | 'dark'
const KEY = 'at:theme'

const mode = ref<ThemeMode>(getItem<ThemeMode>(KEY) === 'dark' ? 'dark' : 'light')

/** 当前主题类名，绑定到每页根节点 */
export function useTheme() {
  const themeClass = computed(() => (mode.value === 'dark' ? 'theme-dark' : 'theme-light'))

  function setTheme(next: ThemeMode) {
    mode.value = next
    setItem(KEY, next)
    applyNavBar(next)
  }

  function toggleTheme() {
    setTheme(mode.value === 'dark' ? 'light' : 'dark')
  }

  return { mode, themeClass, setTheme, toggleTheme }
}

/** 导航栏颜色跟随主题（失败静默，如页面未渲染时） */
export function applyNavBar(m: ThemeMode = mode.value): void {
  const fg = m === 'dark' ? '#ffffff' : '#ffffff'
  const bg = m === 'dark' ? '#0f172a' : '#2456e6'
  try {
    uni.setNavigationBarColor({ frontColor: fg, backgroundColor: bg, fail: () => undefined })
  } catch {
    /* 忽略 */
  }
}

/** 页面 onShow 时调用，保证导航栏与当前主题一致 */
export function syncNavBar(): void {
  applyNavBar()
}
