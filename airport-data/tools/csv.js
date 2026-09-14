'use strict'
/**
 * 最小 RFC4180 CSV 解析，仅用于本项目上游发布的 airports.csv（字段内无换行）。
 * 支持：双引号包裹、引号内逗号、"" 转义、CRLF/LF/CR 行尾、末尾空行、BOM。
 * 字段数与表头不齐时抛错，绝不静默错位。
 */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r') {
      /* CRLF 中的 \r 跳过；孤立 \r 视为换行 */
      if (text[i + 1] !== '\n') {
        row.push(field)
        rows.push(row)
        row = []
        field = ''
      }
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  const data = rows.filter((r) => r.length > 1 || r[0] !== '')
  if (data.length === 0) throw new Error('CSV 无表头')
  const header = data.shift()
  return data.map((r, idx) => {
    if (r.length !== header.length) {
      throw new Error(`CSV 第 ${idx + 2} 行字段数 ${r.length} ≠ 表头 ${header.length}`)
    }
    const o = {}
    header.forEach((h, j) => (o[h] = r[j]))
    return o
  })
}

module.exports = { parseCsv }
