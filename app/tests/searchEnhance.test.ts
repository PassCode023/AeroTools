import { describe, it, expect } from 'vitest'
import { normalizeQuery } from '../src/utils/searchNormalize'
import { searchAirports, type Airport } from '../src/utils/airportSearch'

// v1.1.1 查询归一化（迭代计划 §6.2）：大小写、全角半角、空格、连字符、点号、拉丁重音。

describe('normalizeQuery（§6.2 查询归一化）', () => {
  it('大小写归一', () => {
    expect(normalizeQuery('PEK')).toBe('pek')
    expect(normalizeQuery('ShangHai')).toBe('shanghai')
  })
  it('全角转半角（字母、数字、句点）', () => {
    expect(normalizeQuery('ＰＥＫ')).toBe('pek')
    expect(normalizeQuery('ＺＢＡＡ')).toBe('zbaa')
    expect(normalizeQuery('P．E．K')).toBe('pek')
  })
  it('空格剔除', () => {
    expect(normalizeQuery('P E K')).toBe('pek')
    expect(normalizeQuery('北京 首都')).toBe('北京首都')
    expect(normalizeQuery('\u3000ZB\u3000AA\u3000')).toBe('zbaa')
  })
  it('连字符剔除', () => {
    expect(normalizeQuery('ZB-AA')).toBe('zbaa')
    expect(normalizeQuery('shanghai-hongqiao')).toBe('shanghaihongqiao')
  })
  it('点号剔除', () => {
    expect(normalizeQuery('P.E.K')).toBe('pek')
  })
  it('拉丁重音剥离', () => {
    expect(normalizeQuery('ÜRÜMQI')).toBe('urumqi')
    expect(normalizeQuery('München')).toBe('munchen')
    expect(normalizeQuery('Tokyō')).toBe('tokyo')
  })
  it('组合处理', () => {
    expect(normalizeQuery(' Ü．RÜ－MQI ')).toBe('urumqi')
  })
})

// v1.1.1 搜索增强（§6.1/§6.3）：英文、全拼、拼音首字母、旧名；排序；50 条上限。
// py = 构建期全拼（段间 | 分隔：机场名/城市/旧名）；pj = 构建期拼音首字母。

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
  A({
    iata: 'PEK', icao: 'ZBAA', nameZh: '北京首都国际机场',
    nameEn: 'Beijing Capital International Airport', cityZh: '北京', cityEn: 'Beijing',
    country: '中国', tz: 'Asia/Shanghai',
    py: 'beijingshouduguojijichang|beijing', pj: 'bjsdgjjc|bj',
  }),
  A({
    iata: 'PKX', icao: 'ZBAD', nameZh: '北京大兴国际机场',
    nameEn: 'Beijing Daxing International Airport', cityZh: '北京', cityEn: 'Beijing',
    country: '中国', tz: 'Asia/Shanghai',
    py: 'beijingdaxingguojijichang|beijing', pj: 'bjdxgjjc|bj',
  }),
  A({
    iata: 'SHA', icao: 'ZSSS', nameZh: '上海虹桥国际机场',
    nameEn: 'Shanghai Hongqiao International Airport', cityZh: '上海', cityEn: 'Shanghai',
    country: '中国', tz: 'Asia/Shanghai',
    py: 'shanghaihongqiaoguojijichang|shanghai', pj: 'shhqgjjc|sh',
  }),
  A({
    iata: 'PVG', icao: 'ZSPD', nameZh: '上海浦东国际机场',
    nameEn: 'Shanghai Pudong International Airport', cityZh: '上海', cityEn: 'Shanghai',
    country: '中国', tz: 'Asia/Shanghai',
    py: 'shanghaipudongguojijichang|shanghai', pj: 'shpdgjjc|sh',
  }),
  A({
    iata: 'URC', icao: 'ZWWW', nameZh: '乌鲁木齐天山国际机场',
    nameEn: 'Ürümqi Tianshan International Airport', cityZh: '乌鲁木齐', cityEn: 'Ürümqi',
    country: '中国', tz: 'Asia/Shanghai', aliases: ['乌鲁木齐地窝堡国际机场'],
    py: 'wulumuqitianshanguojijichang|wulumuqi|wulumuqidiwobaoguojijichang',
    pj: 'wlmqtsgjjc|wlmq|wlmqdwbgjjc',
  }),
  A({
    iata: 'LAX', icao: 'KLAX', nameZh: '洛杉矶国际机场',
    nameEn: 'Los Angeles International Airport', cityZh: '洛杉矶', cityEn: 'Los Angeles',
    country: '美国', tz: 'America/Los_Angeles',
    py: 'luoshanjiguojijichang|luoshanji', pj: 'lsjgjjc|lsj',
  }),
]

describe('英文搜索（§6.5）', () => {
  it('城市英文精确：beijing → PEK、PKX', () => {
    const r = searchAirports(fixtures, 'beijing')
    expect(r.map((a) => a.iata)).toEqual(['PEK', 'PKX'])
  })
  it('机场英文前缀（含空格剔除）：shanghaihongqiao → SHA', () => {
    const r = searchAirports(fixtures, 'shanghai hongqiao')
    expect(r[0].iata).toBe('SHA')
  })
  it('大小写不敏感：Los Angeles', () => {
    const r = searchAirports(fixtures, 'LOS ANGELES')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('LAX')
  })
  it('拉丁重音：urumqi → URC（nameEn/cityEn 带重音）', () => {
    const r = searchAirports(fixtures, 'urumqi')
    expect(r.map((a) => a.iata)).toEqual(['URC'])
  })
})

describe('全拼搜索（§6.1/§6.5）', () => {
  it('机场名全拼包含：shoudu → PEK', () => {
    const r = searchAirports(fixtures, 'shoudu')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('PEK')
  })
  it('城市全拼精确：beijing 属于全拼段精确（排名高于包含）', () => {
    const r = searchAirports(fixtures, 'beijing')
    expect(r.map((a) => a.iata)).toEqual(['PEK', 'PKX'])
  })
  it('全拼前缀：shangh → SHA、PVG（机场名全拼公共前缀，同分按原序）', () => {
    const r = searchAirports(fixtures, 'shangh')
    expect(r.map((a) => a.iata)).toEqual(['SHA', 'PVG'])
  })
})

describe('拼音首字母搜索（§6.1/§6.5）', () => {
  it('机场名首字母全串：bjsdgjjc → PEK', () => {
    const r = searchAirports(fixtures, 'bjsdgjjc')
    expect(r.map((a) => a.iata)).toEqual(['PEK'])
  })
  it('首字母前缀：bjs → PEK', () => {
    const r = searchAirports(fixtures, 'bjs')
    expect(r.map((a) => a.iata)).toEqual(['PEK'])
  })
  it('城市首字母精确：bj → PEK、PKX', () => {
    const r = searchAirports(fixtures, 'bj')
    expect(r.map((a) => a.iata)).toEqual(['PEK', 'PKX'])
  })
})

describe('旧名搜索（§6.5）', () => {
  it('中文旧名包含：地窝堡 → URC', () => {
    const r = searchAirports(fixtures, '地窝堡')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('URC')
  })
  it('旧名全拼：diwobao → URC', () => {
    const r = searchAirports(fixtures, 'diwobao')
    expect(r.map((a) => a.iata)).toEqual(['URC'])
  })
})

describe('查询归一化进入搜索', () => {
  it('全角代码：ＰＥＫ → PEK', () => {
    const r = searchAirports(fixtures, 'ＰＥＫ')
    expect(r).toHaveLength(1)
    expect(r[0].iata).toBe('PEK')
  })
  it('点号/连字符代码：P.E.K → PEK；ZB-AA → ZBAA', () => {
    expect(searchAirports(fixtures, 'P.E.K').map((a) => a.iata)).toEqual(['PEK'])
    expect(searchAirports(fixtures, 'ZB-AA').map((a) => a.iata)).toEqual(['PEK'])
  })
  it('中文带空格：北京 首都 → PEK', () => {
    const r = searchAirports(fixtures, '北京 首都')
    expect(r.map((a) => a.iata)).toEqual(['PEK'])
  })
})

describe('排序规则（§6.3）', () => {
  it('代码精确 > 代码前缀 > 文本精确 > 文本前缀 > 包含', () => {
    // 构造一条 nameZh 恰为 "sha" 的记录 + 一条 icao 以 sha 开头的记录
    const list = [
      ...fixtures,
      A({ iata: 'XXX', icao: 'ZSHAX', nameZh: '沙县机场', cityZh: '沙县', country: '中国' }),
    ]
    // 'sha'：SHA=IATA 精确(t1)；无代码前缀；文本精确无；文本前缀：沙县 zh 含 'sha'? 否（zh 不拉丁化）
    const r = searchAirports(list, 'sha')
    expect(r[0].iata).toBe('SHA')
  })
  it('同分保持数据库原始顺序（城市精确：beijing）', () => {
    const r = searchAirports(fixtures, 'beijing')
    expect(r.map((a) => a.iata)).toEqual(['PEK', 'PKX'])
  })
  it('文本前缀同分按原始顺序：shangh → SHA、PVG', () => {
    const r = searchAirports(fixtures, 'shangh')
    expect(r.map((a) => a.iata)).toEqual(['SHA', 'PVG'])
  })
})

describe('50 条上限（§6.3）', () => {
  it('超过 60 条匹配时只返回 50', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      A({ iata: `T${String(i).padStart(2, '0')}`.slice(0, 3).toUpperCase().padEnd(3, 'X'), nameZh: `测试机场${i}`, cityZh: '测试', country: '中国' })
    )
    const r = searchAirports(many, '测试')
    expect(r).toHaveLength(50)
  })
})
