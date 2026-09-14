#!/usr/bin/env node
/**
 * v1.0.2 补齐 34 个境内运输机场（名录在册、库内缺失）。
 * 字段取自 OurAirports / airportsdata 原始 CSV（见 raw/ 与 SOURCES.md）：
 *   - 坐标/代码以 OurAirports 为主源；OurAirports 缺失或陈旧时用 airportsdata（蚌埠滕湖、
 *     额济纳桃来、昭苏天马海拔、奇台整套）。
 *   - 海拔按 ft × 0.3048 四舍五入为米；两个来源均无可靠海拔（0 为占位）时整个字段留空。
 *   - 无真实 ICAO（airportsdata 伪代码 _BFY）时 icao 留空。
 * 本脚本一次性产出 data-cn-5.json；caacRef 由 migrate-v102.js 按名录补注。
 */
const fs = require('fs')
const path = require('path')

// [官方中文名, iata, icao, nameEn, cityZh, cityEn, lat, lng, elevFt?, 坐标来源说明]
const rows = [
  ['阆中古城机场', 'LZG', 'ZULA', 'Langzhong Gucheng Airport', '阆中', 'Langzhong', 31.50191, 106.034417, 1444],
  ['阿里普兰机场', 'APJ', 'ZUPL', 'Ali Pulan Airport', '阿里', 'Burang', 30.397898, 81.13317, 13943],
  ['湘西边城机场', 'DXJ', 'ZGXX', 'Xiangxi Biancheng Airport', '湘西', 'Xiangxi', 28.497, 109.522, null],
  ['朔州滋润机场', 'SZH', 'ZBSG', 'Shuozhou Zirun Airport', '朔州', 'Shuozhou', 39.273, 112.692, null],
  ['邢台褡裢机场', 'XNT', 'ZBXT', 'Xingtai Dalian Airport', '邢台', 'Xingtai', 36.883, 114.429, 280],
  ['绥芬河东宁机场', 'HSF', 'ZYSD', 'Suifenhe Dongning Airport', '牡丹江', 'Suifenhe', 44.454, 130.844, 1407],
  ['奇台江布拉克机场', 'JBK', 'ZWQT', 'Qitai Jiangbulake Airport', '昌吉', 'Qitai', 44.183, 89.5945, 2169, '坐标海拔取 airportsdata（OurAirports 坐标偏移约 4km，不混用）'],
  ['铜仁德江机场', 'DEJ', 'ZUDJ', 'Tongren Dejiang Airport', '铜仁', 'Tongren', 28.121, 108.163, 3542],
  ['巴里坤大河机场', 'DHH', 'ZWLK', 'Barkol Dahe Airport', '哈密', 'Barkol', 43.757, 93.137, 5720],
  ['赣州瑞金机场', 'JRJ', 'ZSRJ', 'Ganzhou Ruijin Airport', '赣州', 'Ganzhou', 25.960236, 116.077016, 750],
  ['蚌埠滕湖机场', 'BFY', '', 'Bengbu Tenghu Airport', '蚌埠', 'Bengbu', 33.166, 117.057, 100, 'OurAirports 仍为旧任圩机场坐标，取 airportsdata 新址；无真实 ICAO'],
  ['嘉兴南湖机场', 'JNH', 'ZSJX', 'Jiaxing Nanhu Airport', '嘉兴', 'Jiaxing', 30.698056, 120.663056, 15],
  ['丽水机场', 'LIJ', 'ZSLI', 'Lishui Airport', '丽水', 'Lishui', 28.3727, 119.839, null],
  ['亳州机场', 'BZJ', 'ZSBO', 'Bozhou Airport', '亳州', 'Bozhou', 33.560777, 115.911859, null],
  ['和静巴音布鲁克机场', 'HJB', 'ZWHJ', 'Hejing Bayinbuluke Airport', '和静', 'Hejing', 42.976395, 83.995543, 8219],
  ['重庆巫山机场', 'WSK', 'ZUWS', 'Chongqing Wushan Airport', '重庆', 'Chongqing', 31.069, 109.709, null],
  ['重庆仙女山机场', 'CQW', 'ZUWL', 'Chongqing Xiannvshan Airport', '重庆', 'Chongqing', 29.466, 107.694, 1747],
  ['凯里黄平机场', 'KJH', 'ZUKJ', 'Kaili Huangping Airport', '凯里', 'Kaili', 26.972, 107.988, 3115],
  ['山南隆子机场', 'LGZ', 'ZUSH', 'Shannan Longzi Airport', '山南', 'Shannan', 28.422, 92.348, 12959],
  ['海北祁连机场', 'HBQ', 'ZLHB', 'Haibei Qilian Airport', '海北', 'Haibei', 38.008, 100.645, 10377],
  ['日喀则定日机场', 'DDR', 'ZUDR', 'Shigatse Tingri Airport', '日喀则', 'Shigatse', 28.604567, 86.798, 14108],
  ['长海大长山岛机场', 'CNI', 'ZYCH', 'Changhai Dachangshandao Airport', '长海', 'Changhai', 39.266, 122.667, 80],
  ['黔南荔波机场', 'LLB', 'ZULB', 'Libo Airport', '黔南', 'Libo', 25.453, 107.962, null],
  ['黔东南黎平机场', 'HZH', 'ZUNP', 'Liping Airport', '黔东南', 'Liping', 26.322, 109.15, 1620],
  ['沧源佤山机场', 'CWJ', 'ZPCW', 'Cangyuan Washan Airport', '沧源', 'Cangyuan', 23.276, 99.373, null],
  ['澜沧景迈机场', 'JMJ', 'ZPJM', 'Lancang Jingmai Airport', '澜沧', 'Lancang', 22.418, 99.784, null],
  ['阿拉善左旗巴彦浩特机场', 'AXF', 'ZBAL', 'Alxa Left Banner Bayanhot Airport', '阿拉善左旗', 'Bayanhot', 38.748317, 105.58416, 4560],
  ['阿拉善右旗巴丹吉林机场', 'RHT', 'ZBAR', 'Alxa Right Banner Badanjilin Airport', '阿拉善右旗', 'Badanjilin', 39.225, 101.546, 4659],
  ['额济纳旗桃来机场', 'EJN', 'ZBEN', 'Ejina Banner Taolai Airport', '额济纳旗', 'Ejina', 42.015556, 101.000556, 3068, 'OurAirports 无此行，取 airportsdata'],
  ['扎兰屯成吉思汗机场', 'NZL', 'ZBZL', 'Zhalantun Genghis Khan Airport', '呼伦贝尔', 'Zhalantun', 47.866, 122.769, 928],
  ['霍林郭勒霍林河机场', 'HUO', 'ZBHZ', 'Holingol Huolinhe Airport', '通辽', 'Holingol', 45.487, 119.407, null],
  ['于田万方机场', 'YTW', 'ZWYT', 'Yutian Wanfang Airport', '和田', 'Yutian', 36.809, 81.783, 4731],
  ['昭苏天马机场', 'ZFL', 'ZWZS', 'Zhaosu Tianma Airport', '伊犁', 'Zhaosu', 43.088477, 81.223013, 5817, '海拔取 airportsdata'],
  ['塔什库尔干红其拉甫机场', 'HQL', 'ZWTK', 'Tashkurgan Khunjerab Airport', '喀什', 'Tashkurgan', 37.661333, 75.288877, 10499],
]

const notes = {}
const out = rows.map(([nameZh, iata, icao, nameEn, cityZh, cityEn, lat, lng, elevFt, note]) => {
  if (note) notes[nameZh] = note
  const r = {
    iata, nameZh, nameEn, cityZh, cityEn, country: '中国',
    lat, lng, tz: 'Asia/Shanghai', aliases: [],
  }
  if (icao) r.icao = icao
  if (elevFt !== null && elevFt !== undefined) r.elevM = Math.round(elevFt * 0.3048)
  return r
})

if (out.length !== 34) throw new Error(`应为 34 条，实际 ${out.length}`)
const iatas = out.filter((r) => r.iata).map((r) => r.iata)
if (new Set(iatas).size !== iatas.length) throw new Error('IATA 重复')
const outPath = path.join(__dirname, '..', 'data-cn-5.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
console.log(`写入 ${outPath}：${out.length} 条；海拔留空 ${out.filter((r) => r.elevM === undefined).length} 条；无 ICAO ${out.filter((r) => !r.icao).length} 条`)
for (const [k, v] of Object.entries(notes)) console.log(`  注记 ${k}: ${v}`)
