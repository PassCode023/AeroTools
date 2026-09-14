import { describe, it, expect } from 'vitest'
import { validateAirportData } from '../src/utils/updater'

const valid = {
  iata: 'PEK', icao: 'ZBAA', nameZh: '北京首都国际机场', nameEn: 'Beijing Capital International Airport',
  cityZh: '北京', cityEn: 'Beijing', country: '中国', lat: 40.08, lng: 116.58, tz: 'Asia/Shanghai', elevM: 35,
}

describe('validateAirportData（P0-3 下载结构校验）', () => {
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
  it('缺少必填字段拒绝', () => {
    const bad = { ...valid } as Record<string, unknown>
    delete bad.nameZh
    expect(() => validateAirportData([bad], 1)).toThrow('nameZh')
  })
  it('坐标越界拒绝', () => {
    expect(() => validateAirportData([{ ...valid, lat: 95 }], 1)).toThrow('坐标')
    expect(() => validateAirportData([{ ...valid, lng: -200 }], 1)).toThrow('坐标')
  })
  it('IATA 与 ICAO 均缺失拒绝', () => {
    const bad = { ...valid, iata: '', icao: '' }
    expect(() => validateAirportData([bad], 1)).toThrow('代码')
  })
})
