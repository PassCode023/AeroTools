# 数据来源登记表（v1.0.2 起）

上游原始文件不入 git（`raw/` 已忽略），本地保留用于审计复现；登记内容：URL、提供方、访问日期、使用字段、获取方式、许可证/边界、原文件 SHA-256。进入仓库的是转换后源数据（`data-*.json`，含 `caacRef`）与登记表快照（`caac-registry.json`）。

## 1. airportsdata（mborsetti/airportsdata）

- URL：https://github.com/mborsetti/airportsdata （CSV：`airportsdata/airports.csv`，main 分支）
- 提供方：Marco Brunetti 等（社区维护）
- 访问日期：2026-09-14；原文件 `raw/airportsdata-airports.csv`（28,298 行）
- SHA-256：`516c57d9d999f7a3be28ca649d2badbe3b972f07e57dc6173ab973b72d51cf52`
- 获取方式：人工下载发布方仓库内公开 CSV（该数据集仅提供 PyPI 包与 CSV，无 npm 包）
- 许可证：MIT
- 使用字段：icao、iata、name（英文名）、city、elevation（英尺）、lat、lon、tz
- 使用边界：34 个补齐机场中 OurAirports 缺行/陈旧时的备选字段来源

## 2. OurAirports（davidmegginson/ourairports-data）

- URL：https://github.com/davidmegginson/ourairports-data （CSV：`airports.csv`，main 分支）
- 提供方：David Megginson
- 访问日期：2026-09-14；原文件 `raw/ourairports-airports.csv`（86,076 行）
- SHA-256：`47880571c7f3129667cc22e5a3fd0ec10f12883b405ca2b3ce40994847610529`
- 获取方式：人工下载发布方仓库内公开 CSV
- 许可证：Unlicense（公共领域奉献）
- 使用字段：ident（ICAO）、iata_code、name、municipality、latitude_deg、longitude_deg、elevation_ft、scheduled_service
- 使用边界：34 个补齐机场的代码/坐标/海拔主源；字段交叉核对

## 3. 中国民航局运输机场名录

- URL：https://www.caac.gov.cn/GYMH/MHGK/MYJC/ （27 页，每页 10 条）
- 提供方：中国民用航空局
- 访问日期：2026-09-14（登记表快照 `caac-registry.json` 已入库）
- 获取方式：人工逐页浏览（工具单页获取，关键页禁用缓存交叉复核）
- 许可证/边界：政府公开信息，仅用于人工事实核对与引用（270 个境内运输机场的名称、地区、省市），不批量复制页面、不编写提取脚本
- 使用字段：机场正式中文名（270 个，含 33 起官方确认更名与旧名对照）、地区、省市

## 4. 中国民航局《2025年全国民用运输机场生产统计公报》（附件）

- 公报页 URL：https://www.caac.gov.cn/XXGK/XXGK/TJSJ/202602/t20260226_230119.html
- PDF：`raw/caac-2025-gongbao.pdf`（5 页）— SHA-256：`58f1b5ba79a52773fb0177099c6a2a432588515fc537eb3e6a118fd26ce42f49`
- 排名表：`raw/caac-2025-throughput-ranking.xlsx` — SHA-256：`0f74dc7bbac864ddc64c6e940f5c4b0710a3d1ad61e77eb0dc0085ba61908794`
- 提供方：中国民用航空局发展计划司；发布日期 2026-02-26
- 访问日期：2026-09-14
- 获取方式：人工下载公报页公开附件（PDF、XLSX 各一份）
- 许可证/边界：政府公开统计信息，仅用于人工事实核对（270 总数口径、253 个排名机场的身份交叉验证），不进入再分发数据
- 使用字段：机场总数（270）、机场短名（城市/短名格式，用于第 9 页恢复的三重交叉验证之一）

## 处理结论记录（对账 2026-09-14）

- 名录 270 与库内对账：33 起官方确认更名（旧名进 `aliases`，客户端展示为"曾用名"）；34 个在册缺失机场已按上表来源补齐（9 个无可靠海拔、1 个无真实 ICAO，均按契约留空）。
- 吉林二台子机场（JIL/ZYJL）：OurAirports 标注无定期航班（停航），不在名录 270 内，按"通用机场库"保留、不携带 `caacRef`。
- 港澳台 10 条：保留在通用库，不计入 270 门禁。
- 名录站点 CDN 存在新旧快照混杂，第 9 页经三重交叉验证恢复（差集法 + 官方排名表 + 直读复核），详见 `docs/V1.0.2-迭代记录.md`。
