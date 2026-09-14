import { describe, it, expect } from 'vitest'
import { validateAirportData } from '../src/utils/updater'

// v1.0.2 数据契约：仅中文名与国家必填，其余字段缺失合法、存在时须合法
const valid = {
  iata: 'PEK', icao: 'ZBAA', nameZh: '北京首都国际机场', nameEn: 'Beijing Capital International Airport',
  cityZh: '北京', cityEn: 'Beijing', country: '中国', lat: 40.08, lng: 116.58, tz: 'Asia/Shanghai', elevM: 35,
}

describe('validateAirportData（下载结构校验，与内置契约一致）', () => {
  it('合法数据原样通过', () => {
    const data = [valid, { ...valid, iata: 'PKX', icao: 'ZBAD' }]
    expect(validateAirportData(data, 2)).toHaveLength(2)
  })
  it('非数组拒绝', () => {
    expect(() => validateAirportData({ foo: 1 }, 1)).toThrow('非数组')
  })
  it('条数不符拒绝', () => {
    expect(() => validateAirportData([valid], 2)).toThrow('条数不符')
  })
  it('缺少中文名或国家拒绝', () => {
    const bad1 = { ...valid } as Record<string, unknown>
    delete bad1.nameZh
    expect(() => validateAirportData([bad1], 1)).toThrow('nameZh')
    const bad2 = { ...valid } as Record<string, unknown>
    delete bad2.country
    expect(() => validateAirportData([bad2], 1)).toThrow('country')
  })
  it('英文名/城市/坐标/时区/代码缺失时通过（可选字段）', () => {
    const minimal = { nameZh: '某机场', country: '中国' }
    expect(validateAirportData([minimal], 1)).toHaveLength(1)
    const noCoords = { ...valid } as Record<string, unknown>
    delete noCoords.lat
    delete noCoords.lng
    delete noCoords.tz
    delete noCoords.nameEn
    delete noCoords.cityEn
    delete noCoords.iata
    delete noCoords.icao
    expect(validateAirportData([noCoords], 1)).toHaveLength(1)
  })
  it('坐标存在但越界拒绝', () => {
    expect(() => validateAirportData([{ ...valid, lat: 95 }], 1)).toThrow('坐标')
    expect(() => validateAirportData([{ ...valid, lng: -200 }], 1)).toThrow('坐标')
    expect(() => validateAirportData([{ ...valid, lat: '40.1' }], 1)).toThrow('坐标')
  })
})
