/**
 * 生成阿里巴巴普惠体 3.0 子集字体并输出 base64 内嵌样式。
 *
 * 用法:
 *   1. 从官方 https://www.alibabafonts.com/ 下载整包(有防盗链,需页面内下载),
 *      解压后把各字重 TTF 放到同一目录;
 *   2. 执行 npm run font:subset -- <TTF所在目录>
 *   3. 脚本扫描 src/ 实际用字,生成 src/styles/puhuiti.scss(勿手改,重新生成即可)。
 *
 * 设计说明:
 *   - Regular 覆盖「源码用到的全部字符」(含中文);Bold 仅覆盖拉丁/数字/符号。
 *     纯粹展示性 bold 的中文由系统字体合成加粗,省一半体积。
 *   - 小程序 wxss 不支持本地字体路径,故用 data URI 内嵌;微信同样不支持
 *     未配置合法域名的网络字体,内嵌是唯一零配置方案。
 */
import fs from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'

const SRC_ROOT = path.resolve(import.meta.dirname, '../src')
const OUT_FILE = path.resolve(import.meta.dirname, '../src/styles/puhuiti.scss')

// 各字重定义:文件名为官方整包内 TTF 名,latinOnly = 只保留非 CJK 字符
const WEIGHTS = [
  { file: 'AlibabaPuHuiTi-3-55-Regular.ttf', weight: 400, latinOnly: false },
  { file: 'AlibabaPuHuiTi-3-85-Bold.ttf', weight: 700, latinOnly: true },
]

function collectSourceText(dir) {
  let text = ''
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) text += collectSourceText(p)
    else if (/\.(vue|ts|scss|css|json)$/.test(entry.name)) text += fs.readFileSync(p, 'utf8')
  }
  return text
}

const isCJK = (c) => /[\u2e80-\u9fff\u3400-\u4dbf\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/.test(c)

function buildCharset(text, latinOnly) {
  const set = new Set()
  // 全量可打印 ASCII,保证数字/字母/标点在任何页面都命中
  for (let i = 0x20; i <= 0x7e; i++) set.add(String.fromCodePoint(i))
  for (const c of text) {
    if (c.charCodeAt(0) < 0x20) continue
    if (latinOnly && isCJK(c)) continue
    set.add(c)
  }
  return [...set].join('')
}

const inputDir = process.argv[2]
if (!inputDir) {
  console.error('用法: node scripts/make-font-subset.mjs <普惠体TTF所在目录>')
  process.exit(1)
}

const sourceText = collectSourceText(SRC_ROOT)
const faces = []

for (const w of WEIGHTS) {
  const ttfPath = path.join(inputDir, w.file)
  if (!fs.existsSync(ttfPath)) {
    console.error(`缺少字重文件: ${ttfPath}`)
    process.exit(1)
  }
  const charset = buildCharset(sourceText, w.latinOnly)
  const woff2 = await subsetFont(fs.readFileSync(ttfPath), charset, { targetFormat: 'woff2' })
  const b64 = woff2.toString('base64')
  faces.push(
    `/* ${w.weight === 400 ? 'Regular(含中文,全量源码用字)' : 'Bold(仅拉丁/数字/符号,中文走系统加粗)'} */\n` +
      `@font-face {\n` +
      `  font-family: 'PuHuiTi';\n` +
      `  src: url(data:font/woff2;base64,${b64}) format('woff2');\n` +
      `  font-weight: ${w.weight};\n` +
      `  font-style: normal;\n` +
      `  font-display: swap;\n` +
      `}`,
  )
  console.log(`weight ${w.weight}: 字符 ${charset.length} 个,woff2 ${(woff2.length / 1024).toFixed(1)} KB`)
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(
  OUT_FILE,
  `/* 由 scripts/make-font-subset.mjs 自动生成,请勿手改;改字体/字符集后重新执行 npm run font:subset。\n` +
    `   字体:阿里巴巴普惠体 3.0(官方授权:永久免费商用,无需署名) https://www.alibabafonts.com/ */\n` +
    faces.join('\n\n') +
    `\n`,
)
console.log(`已生成 ${path.relative(process.cwd(), OUT_FILE)}`)
