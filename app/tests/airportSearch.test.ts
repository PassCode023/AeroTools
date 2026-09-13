import { describe, it, expect } from 'vitest'
import { searchAirports, type Airport } from '../src/utils/airportSearch'

const A = (o: Partial<Airport>): Airport => ({
  iata: '',
  icao: '',
  nameZh: '',
  nameEn: '',
  cityZh: '',
  cityEn: '',
  country: '',
  lat: 0,
  lng: 0,
  tz: 'UTC',
  ...o,
})

const fixtures: Airport[] = [
  A({ iata: 'PEK', icao: 'ZBAA', nameZh: '北京首都国际机场', nameEn: 'Beijing Capital International Airport', cityZh: '北京', cityEn: 'Beijing', country: '中国', lat: 40.08, lng: 116.58, tz: 'Asia/Shanghai' }),
  A({ iata: 'PKX', icao: 'ZBAD', nameZh: '北京大兴国际机场', nameEn: 'Beijing Daxing International Airport', cityZh: '北京', cityEn: 'Beijing', country: '中国', lat: 39.51, lng: 116.41, tz: 'Asia/Shanghai' }),
  A({ iata: 'SHA', icao: 'ZSSS', nameZh: '上海虹桥国际机场', nameEn: 'Shanghai Hongqiao International Airport', cityZh: '上海', cityEn: 'Shanghai', country: '中国', lat: 31.2, lng: 121.34, tz: 'Asia/Shanghai' }),
  A({ iata: 'PVG', icao: 'ZSPD', nameZh: '上海浦东国际机场', nameEn: 'Shanghai Pudong International Airport', cityZh: '上海', cityEn: 'Shanghai', country: '中国', lat: 31.14, lng: 121.8, tz: 'Asia/Shanghai' }),
  A({ iata: 'CAN', icao: 'ZGGG', nameZh: '广州白云国际机场', nameEn: 'Guangzhou Baiyun International Airport', cityZh: '广州', cityEn: 'Guangzhou', country: '中国', lat: 23.39, lng: 113.3, tz: 'Asia/Shanghai' }),
  A({ iata: 'LAX', icao: 'KLAX', nameZh: '洛杉矶国际机场', nameEn: 'Los Angeles International Airport', cityZh: '洛杉矶', cityEn: 'Los Angeles', country: '美国', lat: 33.94, lng: -118.41, tz: 'America/Los_Angeles' }),
  A({ iata: 'NRT', icao: 'RJAA', nameZh: '东京成田国际机场', nameEn: 'Narita International Airport', cityZh: '东京', cityEn: 'Tokyo', country: '日本', lat: 35.77, lng: 140.39, tz: 'Asia/Tokyo' }),
  A({ iata: '', icao: 'ZLXY', nameZh: '某通用机场', nameEn: 'Some General Airport', cityZh: '某城', cityEn: 'Somecheng', country: '中国', lat: 34.4, lng: 108.75, tz: 'Asia/Shanghai' }),
]

describe('searchAirports', () => {
  it('空查询返回空', () => {
    expect(searchAirports(fixtures, '')).toEqual([])
    expect(searchAirports(fixtures, '   ')).toEqual([])
  })
  it('无结果返回空', () => {
    expect(searchAirports(fixtures, 'ZZZZ')).toEqual([])
    expect(searchAirports(fixtures, '不存在的城市')).toEqual([])
  })
  it('IATA 精确前缀优先（大小写不敏感）', () => {
    const r = searchAirports(fixtures, 'pek')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('PEK')
  })
  it('IATA 前缀唯一匹配：PE → PEK', () => {
    const r = searchAirports(fixtures, 'PE')
    expect(r.map((a) => a.iata)).toEqual(['PEK'])
  })
  it('ICAO 查询', () => {
    const r = searchAirports(fixtures, 'ZBAA')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('PEK')
  })
  it('ICAO 小写查询', () => {
    const r = searchAirports(fixtures, 'rjaa')
    expect(r[0].iata).toBe('NRT')
  })
  it('中文名称匹配', () => {
    const r = searchAirports(fixtures, '虹桥')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('SHA')
  })
  it('中文城市名匹配：上海 → SHA、PVG', () => {
    const r = searchAirports(fixtures, '上海')
    expect(r.map((a) => a.iata).sort()).toEqual(['PVG', 'SHA'])
  })
  it('城市匹配：北京 → PEK、PKX', () => {
    const r = searchAirports(fixtures, '北京')
    expect(r.map((a) => a.iata).sort()).toEqual(['PEK', 'PKX'])
  })
  it('排名：IATA 前缀排在名称包含之前', () => {
    // "京" 匹配北京两场的名称/城市；但无 IATA 前缀。构造与 IATA 冲突的查询：
    const r = searchAirports(fixtures, 'LA')
    // LAX 的 IATA 前缀 + 洛杉矶 cityEn 前缀，应排第一且只有它
    expect(r[0].iata).toBe('LAX')
  })
  it('无 IATA 的机场也能通过 ICAO 查到', () => {
    const r = searchAirports(fixtures, 'ZLXY')
    expect(r).toHaveLength(1)
    expect(r[0].icao).toBe('ZLXY')
  })
  it('limit 限制返回数量', () => {
    const r = searchAirports(fixtures, '国', 2)
    expect(r).toHaveLength(2)
  })
  it('结果按相关度排序：同为前缀时按原始顺序', () => {
    const r = searchAirports(fixtures, 'P')
    expect(r.map((a) => a.iata)).toEqual(['PEK', 'PKX', 'PVG'])
  })
})
