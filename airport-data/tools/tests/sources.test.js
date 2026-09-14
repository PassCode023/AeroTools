const test = require('node:test')
const assert = require('node:assert/strict')
const { fromOurAirports, fromAirportsdata, fromCaacAudit } = require('../sources.js')

test('fromOurAirports：ZBAA 取 icao_code，坐标与海拔英尺转米', () => {
  const [r] = fromOurAirports([
    {
      ident: 'ZBAA', type: 'large_airport', name: 'Beijing Capital International Airport',
      latitude_deg: '40.079998', longitude_deg: '116.603104', elevation_ft: '116',
      iso_country: 'CN', municipality: 'Beijing', icao_code: 'ZBAA', iata_code: 'PEK',
    },
  ])
  assert.equal(r.__source, 'ourairports')
  assert.equal(r.icao, 'ZBAA')
  assert.equal(r.iata, 'PEK')
  assert.equal(r.nameEn, 'Beijing Capital International Airport')
  assert.equal(r.cityEn, 'Beijing')
  assert.equal(r.lat, 40.079998)
  assert.equal(r.lng, 116.603104)
  assert.equal(r.elevM, 35) // 116 ft ≈ 35.4 m
  assert.equal(r.countryCode, 'CN')
})

test('fromOurAirports：icao_code 为空且 ident 非四字母时无 ICAO（美国本地代码）', () => {
  const [r] = fromOurAirports([
    { ident: '00A', type: 'heliport', name: 'Total RF Heliport', latitude_deg: '40.07', longitude_deg: '-74.93', elevation_ft: '11', iso_country: 'US', municipality: 'Bensalem', icao_code: '', iata_code: '' },
  ])
  assert.equal(r.icao, undefined)
  assert.equal(r.iata, undefined)
})

test('fromOurAirports：海拔为空时 elevM 为 undefined，不为伪造 0', () => {
  const [r] = fromOurAirports([
    { ident: 'ZXXX', type: 'small_airport', name: 'X', latitude_deg: '1', longitude_deg: '2', elevation_ft: '', iso_country: 'CN', municipality: '', icao_code: 'ZXXX', iata_code: '' },
  ])
  assert.equal(r.elevM, undefined)
})

test('fromAirportsdata：tz 透传，海拔英尺转米，空 iata 为 undefined', () => {
  const [r] = fromAirportsdata([
    { icao: 'ZBAA', iata: 'PEK', name: 'Beijing Capital International Airport', city: 'Beijing', subd: 'Beijing', country: 'CN', elevation: '116', lat: '40.08', lon: '116.58', tz: 'Asia/Shanghai', lid: '' },
  ])
  assert.equal(r.__source, 'airportsdata')
  assert.equal(r.icao, 'ZBAA')
  assert.equal(r.iata, 'PEK')
  assert.equal(r.tz, 'Asia/Shanghai')
  assert.equal(r.elevM, 35)
  const [noIata] = fromAirportsdata([
    { icao: 'ZXXX', iata: '', name: 'X', city: '', subd: '', country: 'CN', elevation: '', lat: '1', lon: '2', tz: 'Asia/Shanghai', lid: '' },
  ])
  assert.equal(noIata.iata, undefined)
  assert.equal(noIata.elevM, undefined)
})

test('fromAirportsdata：非四字母伪 ICAO 标识不进入 icao 键位', () => {
  const [r] = fromAirportsdata([
    { icao: '00AK', iata: '', name: 'US local', city: '', subd: '', country: 'US', elevation: '', lat: '1', lon: '2', tz: '', lid: '00AK' },
  ])
  assert.equal(r.icao, undefined)
})

test('fromCaacAudit：名录条目映射为官方事实记录', () => {
  const [r] = fromCaacAudit({
    airports: [
      { page: 2, name: '北京首都国际机场', region: '华北地区', province: '北京' },
    ],
  })
  assert.equal(r.__source, 'caac')
  assert.equal(r.nameZh, '北京首都国际机场')
  assert.equal(r.province, '北京')
  assert.equal(r.region, '华北地区')
  assert.equal(r.icao, undefined) // 名录不带代码
})
