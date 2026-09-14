const test = require('node:test')
const assert = require('node:assert/strict')
const { parseCsv } = require('../csv.js')

test('基本解析：表头键 + 逗号分隔', () => {
  const rows = parseCsv('icao,iata,name\nZBAA,PEK,Beijing Capital\nZBAD,PKX,Beijing Daxing\n')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].icao, 'ZBAA')
  assert.equal(rows[1].name, 'Beijing Daxing')
})

test('引号字段内含逗号', () => {
  const rows = parseCsv('name,city\n"Washington, Dullles",DC\n')
  assert.equal(rows[0].name, 'Washington, Dullles')
  assert.equal(rows[0].city, 'DC')
})

test('双引号转义（"" → "）', () => {
  const rows = parseCsv('name\n"Say ""Hi"" Airport"\n')
  assert.equal(rows[0].name, 'Say "Hi" Airport')
})

test('CRLF 行尾与末尾空行', () => {
  const rows = parseCsv('a,b\r\n1,2\r\n\r\n')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].a, '1')
})

test('字段数不齐时报错而非静默错位', () => {
  assert.throws(() => parseCsv('a,b\n1\n'), /字段数/)
})

test('空字段保留为空字符串', () => {
  const rows = parseCsv('icao,iata\nZBAA,\n')
  assert.equal(rows[0].iata, '')
})
