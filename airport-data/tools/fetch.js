#!/usr/bin/env node
'use strict'
/**
 * 上游开源数据集下载与来源登记 —— 仅供维护者在本机人工触发。
 *
 * 合规边界（docs/AeroTools-路线A-v1.0.2至v1.1.1-迭代计划.md §3.1/§3.2）：
 * - 只下载发布方明确提供的单个公开 CSV；禁止爬虫、批量抓取、未公开接口。
 * - 构建（build.js）、测试、CI 一律不得调用本脚本；三处均只读已入库/已登记数据。
 * - 民航局名录不使用本脚本：名录仅人工逐页浏览核对，事实登记于 caac-registry.json，
 *   比对用 tools/caac-xcheck.js；不存在也不允许存在任何网页提取程序。
 *
 * 登记体系：原始 CSV 存 airport-data/raw/（gitignored）；SOURCES.md 为唯一来源登记表
 * （URL、提供方、访问日期、行数、SHA-256、许可证、使用字段），本脚本自动改写其
 * 第 1/2 节的访问日期、行数与 SHA-256，并在文末「下载更新日志」表追加一行。
 *
 * 用法：node tools/fetch.js            下载两源 CSV → raw/，更新 SOURCES.md 登记
 *       node tools/fetch.js <key>      只处理指定源（ourairports | airportsdata）
 *       node tools/fetch.js --check    不联网：校验 raw/ 现有文件哈希与 SOURCES.md 登记一致
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DATA_ROOT = path.join(__dirname, '..')
const RAW_DIR = path.join(DATA_ROOT, 'raw')
const SOURCES_MD = path.join(DATA_ROOT, 'SOURCES.md')

const SOURCES = {
  ourairports: {
    url: 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv',
    file: 'ourairports-airports.csv',
    section: '## 2. OurAirports',
  },
  airportsdata: {
    url: 'https://raw.githubusercontent.com/mborsetti/airportsdata/main/airportsdata/airports.csv',
    file: 'airportsdata-airports.csv',
    section: '## 1. airportsdata',
  },
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const fmt = (n) => n.toLocaleString('en-US')

function sectionRange(text, heading) {
  const start = text.indexOf(heading)
  if (start < 0) throw new Error(`SOURCES.md 缺少标题「${heading}」——请勿改动登记表小节标题`)
  const end = text.indexOf('\n## ', start + heading.length)
  return [start, end < 0 ? text.indexOf('\n## 处理结论', start) : end]
}

/** 改写指定小节内的访问日期/行数/SHA-256 三处登记 */
function updateSection(md, key, { file, accessDate, sha, lines }) {
  const src = SOURCES[key]
  let [s, e] = sectionRange(md, src.section)
  let sec = md.slice(s, e)
  sec = sec.replace(/- 访问日期：[^；]+；原文件 `raw\/[^`]+`（[\d,]+ 行）/, `- 访问日期：${accessDate}；原文件 \`raw/${file}\`（${fmt(lines)} 行）`)
  sec = sec.replace(/- SHA-256：`[0-9a-f]{64}`/, `- SHA-256：\`${sha}\``)
  return md.slice(0, s) + sec + md.slice(e)
}

function appendLog(md, rows) {
  let out = md
  if (!out.includes('## 下载更新日志')) {
    out = out.trimEnd() + '\n\n## 下载更新日志（tools/fetch.js 自动追加）\n\n| 日期 | 来源 | 行数 | 字节 | SHA-256 |\n|---|---|---|---|---|\n'
  }
  const line = rows.map((r) => `| ${r.accessDate} | ${r.key} | ${fmt(r.lines)} | ${fmt(r.bytes)} | \`${r.sha}\` |`).join('\n')
  return out.trimEnd() + '\n' + line + '\n'
}

async function main() {
  const arg = process.argv[2]
  if (arg === '--check') {
    const md = fs.readFileSync(SOURCES_MD, 'utf8')
    let bad = 0
    for (const key of Object.keys(SOURCES)) {
      const p = path.join(RAW_DIR, SOURCES[key].file)
      const [, e] = sectionRange(md, SOURCES[key].section)
      const sec = md.slice(md.indexOf(SOURCES[key].section), e)
      const want = (sec.match(/- SHA-256：`([0-9a-f]{64})`/) || [])[1]
      const wantLines = Number((sec.match(/（([\d,]+) 行）/) || [])[1].replace(/,/g, ''))
      if (!fs.existsSync(p) || !want) {
        console.log(`${key}: raw/ 文件缺失或登记缺失（运行 node tools/fetch.js 下载）`)
        bad++
        continue
      }
      const got = sha256(fs.readFileSync(p))
      const gotLines = parseRows(fs.readFileSync(p, 'utf8')) - 1
      const ok = got === want && gotLines === wantLines
      console.log(`${key}: ${ok ? '✅ 哈希与行数与 SOURCES.md 登记一致' : `❌ 漂移 sha=${ok ? '' : got} 行数 ${gotLines} vs ${wantLines}`}`)
      if (!ok) bad++
    }
    process.exit(bad ? 1 : 0)
  }
  if (arg && !SOURCES[arg]) {
    console.error(`未知来源: ${arg}（可选 ${Object.keys(SOURCES).join(' | ')} 或 --check）`)
    process.exit(1)
  }
  if (!fs.existsSync(RAW_DIR)) fs.mkdirSync(RAW_DIR, { recursive: true })
  let md = fs.readFileSync(SOURCES_MD, 'utf8')
  const accessDate = new Date().toISOString().slice(0, 10)
  const logRows = []
  for (const key of Object.keys(SOURCES)) {
    if (arg && key !== arg) continue
    const src = SOURCES[key]
    console.log(`下载 ${key}: ${src.url}`)
    const res = await fetch(src.url)
    if (!res.ok) {
      console.error(`  失败 HTTP ${res.status}`)
      process.exit(1)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(path.join(RAW_DIR, src.file), buf)
    const sha = sha256(buf)
    const lines = parseRows(buf.toString('utf8'))
    md = updateSection(md, key, { file: src.file, accessDate, sha, lines: lines - 1 })
    logRows.push({ accessDate, key, lines: lines - 1, bytes: buf.length, sha })
    console.log(`  → raw/${src.file} ${(buf.length / 1048576).toFixed(1)}MB / ${fmt(lines - 1)} 行`)
    console.log(`  SHA-256 ${sha}`)
  }
  if (logRows.length) {
    md = appendLog(md, logRows)
    fs.writeFileSync(SOURCES_MD, md)
    console.log(`SOURCES.md 第 ${logRows.map((r) => r.key).join('/')} 节登记已更新，并追加下载日志`)
    console.log('下一步：node tools/reconcile.js 生成更新线索报告')
  } else {
    console.log('无下载操作')
  }
}

/** 换行计数（LF）；两源 CSV 均无引号内换行 */
function parseRows(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return text.split('\n').filter((l) => l.trim() !== '').length
}

module.exports = { sectionRange, updateSection, appendLog, parseRows }

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
