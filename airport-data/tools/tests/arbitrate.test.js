const test = require('node:test')
const assert = require('node:assert/strict')
const { FIELD_PRIORITY, pickField, mergeAirportRecords, dedupKey } = require('../arbitrate.js')

// 裁定矩阵即规格：三个数据源冲突时的字段级优先级（高 → 低）
test('FIELD_PRIORITY 与既定裁定矩阵一致', () => {
  assert.deepEqual(FIELD_PRIORITY.nameZh, ['caac', 'manual']) // 官方中文名以民航局为准
  assert.deepEqual(FIELD_PRIORITY.cityZh, ['manual', 'caac']) // 名录无城市字段，人工整理优先
  assert.deepEqual(FIELD_PRIORITY.iata, ['caac', 'airportsdata', 'ourairports']) // airportsdata 经 IATA 官方查询验证
  assert.deepEqual(FIELD_PRIORITY.icao, ['caac', 'ourairports', 'airportsdata']) // ICAO 以 OurAirports 为基线
  assert.deepEqual(FIELD_PRIORITY.nameEn, ['ourairports', 'airportsdata'])
  assert.deepEqual(FIELD_PRIORITY.cityEn, ['ourairports', 'airportsdata'])
  assert.deepEqual(FIELD_PRIORITY.lat, ['ourairports', 'airportsdata']) // 坐标以 OurAirports 为基线
  assert.deepEqual(FIELD_PRIORITY.lng, ['ourairports', 'airportsdata'])
  assert.deepEqual(FIELD_PRIORITY.elevM, ['ourairports', 'airportsdata']) // airportsdata 自述海拔常错
  assert.deepEqual(FIELD_PRIORITY.tz, ['airportsdata', 'ourairports']) // OurAirports airports.csv 无时区
  assert.deepEqual(FIELD_PRIORITY.province, ['caac'])
  assert.deepEqual(FIELD_PRIORITY.region, ['caac'])
})

test('pickField：高优先级来源胜出，与候选顺序无关', () => {
  const out = pickField('lat', [
    { __source: 'airportsdata', lat: 39.9 },
    { __source: 'ourairports', lat: 40.08 },
  ])
  assert.deepEqual(out, { value: 40.08, source: 'ourairports' })
})

test('pickField：空值不参与裁定（空串/null/undefined）', () => {
  const out = pickField('nameZh', [
    { __source: 'caac', nameZh: '' },
    { __source: 'manual', nameZh: '北京首都国际机场' },
  ])
  assert.deepEqual(out, { value: '北京首都国际机场', source: 'manual' })
})

test('pickField：0 与负数为合法值（如海拔低于海平面），不被当作缺失', () => {
  const out = pickField('elevM', [
    { __source: 'ourairports', elevM: -3 },
  ])
  assert.deepEqual(out, { value: -3, source: 'ourairports' })
})

test('pickField：所有来源都缺该字段时返回 null', () => {
  assert.equal(pickField('tz', [{ __source: 'caac' }, { __source: 'ourairports' }]), null)
})

test('dedupKey：ICAO 优先，其次 IATA，最后规范化的英文名+国家', () => {
  assert.equal(dedupKey({ icao: 'ZBAA', iata: 'PEK' }), 'icao:ZBAA')
  assert.equal(dedupKey({ iata: 'PEK' }), 'iata:PEK')
  assert.equal(dedupKey({ nameEn: '  Beijing Capital ', countryCode: 'CN' }), 'name:beijing capital|cn')
  assert.equal(dedupKey({ nameEn: 'Beijing Capital', country: '中国' }), 'Name:beijing capital|中国'.toLowerCase())
})

test('mergeAirportRecords：同 ICAO 三源记录合并为一条，逐字段按矩阵取赢家并记录出处', () => {
  const merged = mergeAirportRecords([
    { __source: 'manual', icao: 'ZBAA', iata: 'PEK', nameZh: '北京首都国际机场', cityZh: '北京', country: '中国', cityEn: 'Beijing' },
    { __source: 'ourairports', icao: 'ZBAA', iata: 'PEK', nameEn: 'Beijing Capital International Airport', cityEn: 'Beijing', lat: 40.08, lng: 116.6, elevM: 35 },
    { __source: 'airportsdata', icao: 'ZBAA', iata: 'PEK', nameEn: 'Beijing Capital International Airport', cityEn: 'Beijing', lat: 40.1, lng: 116.5, elevM: 33, tz: 'Asia/Shanghai' },
    { __source: 'caac', nameZh: '北京首都国际机场', province: '北京', region: '华北地区' },
  ])
  assert.equal(merged.length, 1)
  const [m] = merged
  assert.equal(m.record.nameZh, '北京首都国际机场')
  assert.equal(m.record.nameEn, 'Beijing Capital International Airport')
  assert.equal(m.record.cityEn, 'Beijing')
  assert.equal(m.record.lat, 40.08) // ourairports 坐标
  assert.equal(m.record.elevM, 35) // ourairports 海拔
  assert.equal(m.record.tz, 'Asia/Shanghai') // airportsdata 独有
  assert.equal(m.record.province, '北京') // caac 独有
  assert.equal(m.record.country, '中国') // manual 独有
  assert.equal(m.provenance.lat, 'ourairports')
  assert.equal(m.provenance.tz, 'airportsdata')
  assert.equal(m.provenance.province, 'caac')
  assert.equal(m.provenance.country, 'manual')
})

test('mergeAirportRecords：无代码记录按 IATA 分组，不同键不合并', () => {
  const merged = mergeAirportRecords([
    { __source: 'ourairports', nameEn: 'X Airport', countryCode: 'US', lat: 1 },
    { __source: 'airportsdata', nameEn: 'x airport ', countryCode: 'US', tz: 'America/New_York' },
    { __source: 'ourairports', nameEn: 'Y Airport', countryCode: 'US' },
  ])
  assert.equal(merged.length, 2)
  const x = merged.find((m) => m.record.nameEn === 'X Airport')
  assert.equal(x.record.tz, 'America/New_York')
  assert.equal(x.provenance.tz, 'airportsdata')
})
