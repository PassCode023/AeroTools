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
- 名录独立交叉验证（同日第二会话）：人工逐页浏览 27 页生成快照 `tools/caac-snapshot-2026-09-14.json`，经 `tools/caac-xcheck.js` 比对为集合级 0 差异（270 名称与省市属性两源一致）；第 6/8/9 页 30 处槽位轮转符合 CDN 快照混杂预期，登记表内容获得独立复现确认。
- 开源 CSV 可复现性：第二会话经 `tools/fetch.js` 重新下载，两文件 SHA-256 与本登记表逐字节一致（ourairports `47880571…0529`、airportsdata `516c57d9…cf52`），上游快照可精确复现。

### 首批"无上游对应"裁定（2026-09-14，依据 arbitrate.js 矩阵，工具脚本 `tools/arbitrate-6.js`）

上游证据均为人工逐行核对两份登记 CSV；矩阵：icao/坐标/海拔以 OurAirports 优先、iata/时区以 airportsdata 优先、缺位回落次位。

| 机场 | 裁定 | 依据 |
|---|---|---|
| 河池金城江 | icao ZGJJ→ZGHC、iata HCJ→HNI、坐标→OA 精确值（旧值偏约 6km）、海拔 677m | ZGHC 双源一致；iata 取 AD 权威值（OA=HCJ 不采）；海拔双源 2221ft |
| 三沙永兴 | 不改（XYI/ZJYH） | 两上游均未收录该机场；名录 p13e09 为法源 |
| 海西茫崖 | icao ZLHT→ZLHX、iata HXG→HTT、坐标→OA（旧值偏约 17km）、海拔 898m | AD 未收录，回落 OA 单源；nameEn 保留现值（含 Mangya 检索词） |
| 且末玉都 | icao ZWQM→ZWCM、iata QMX→IQM、坐标→OA 新址（AD 坐标疑为老场址）、海拔 1252m | 代码双源一致；OA 名含 Yudu 与新址对应 |
| 若羌楼兰 | iata RZX→RQA、icao 空→ZWRQ、坐标→双源一致精确值（旧值偏约 17km）、海拔 889m | 双源完全一致（ZWRQ/RQA） |
| 比什凯克玛纳斯 | iata FRU→BSZ、icao UAFM→UCFM、坐标→OA 精确值、海拔 627m | 双源一致；吉尔吉斯斯坦换码（OA keywords 保留 FRU/UAFM 旧码为证） |
| 怀化芷江（连带） | icao ZGHC→ZGCJ | 双源一致；库内旧值误占河池 ICAO，被唯一性门禁逮获 |

上述 iata 单源回落（海西茫崖 HTT）与 AD 权威改写（河池 HNI）建议上线前按官方 AIP 复核；旧码遗留于本表与提交历史，可回溯。
