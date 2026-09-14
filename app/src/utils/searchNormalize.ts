/**
 * 查询归一化（v1.1.1 §6.2，纯函数）：
 * 小写、全角→半角、剥拉丁重音（NFD + 组合附加符区段）、剔除空格/连字符/点号。
 * 查询与被搜索文本共用同一归一化，使 "ＰＥＫ"、"P.E.K"、"pek"、"ZB-AA" 等价。
 * 仅用 ECMAScript 内建（String.prototype.normalize 为 ES6 标准而非 Intl），
 * 不触碰运行时 Intl 时区能力（§6.4 的限制仅针对时区偏移）。
 */

/** 全角标点/字母/数字区段（FF01–FF5E）映射回半角的偏移 */
const FW_OFFSET = 0xfee0

/** 分隔符：空格类、连字符类、点号类（含全角形式），归一化时剔除 */
const SEPARATORS = /[\s.\-‐‑‒–—−．·・]/

export function normalizeQuery(input: string): string {
  // NFD 分解后剥离组合附加符（U+0300–U+036F），覆盖 é ü ñ ō 等拉丁重音
  let s = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0) as number
    if (code === 0x3000) continue // 全角空格
    if (code >= 0xff01 && code <= 0xff5e) {
      const half = String.fromCharCode(code - FW_OFFSET)
      if (SEPARATORS.test(half)) continue
      out += half.toLowerCase()
      continue
    }
    if (SEPARATORS.test(ch)) continue
    out += ch.toLowerCase()
  }
  return out
}
