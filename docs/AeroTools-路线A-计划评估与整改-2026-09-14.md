# AeroTools 路线 A 迭代计划：准确性评估与整改记录

> 评估对象：`docs/AeroTools-路线A-v1.0.2至v1.1.1-迭代计划.md`（PLAN_READY 版）
> 评估基线：v1.0.1（tag `v1.0.1`，commit 1b696fc）
> 评估日期：2026-09-14
> 结论：计划总体准确、可执行；发现 1 处事实性错误、3 处实质遗漏、5 处模糊/风险未标注，共 9 项已就地修订进计划文档。

## 1. 核对方法

- 仓库现状：三路并行核查（版本与构建状态、机场数据管道与结构、测试套件与功能现状），关键文件（`airport-data/build.js`、`app/tests/airportsData.test.ts`）另行人工复核。
- 外部事实：民航局公报与名录页、npm registry、两个开源数据集仓库的许可证声明，均通过公开页面人工查阅，未使用任何自动化采集。

## 2. 核对通过的事实性声明

| 计划声明 | 结论 | 证据 |
|---|---|---|
| 基线 v1.0.1 | ✅ | tag `v1.0.1`；`app/package.json`、`app/src/manifest.json`（1.0.1 / versionCode 101）、`app/src/config.ts` 三处一致 |
| 既有 89 项测试 | ✅ | `app/tests/` 6 个测试文件、89 个用例，`vitest run` 全部通过（391ms） |
| 境内运输机场 270 个（截至 2025-12-31） | ✅ | 民航局《2025 年全国民用运输机场生产统计公报》：“截至2025年底，我国境内颁证运输机场（港澳台地区数据另行统计）共270个” |
| 民航局名录页可人工逐页核对 | ✅ | caac.gov.cn/GYMH/MHGK/MYJC 标注“截至2025年12月31日”，共 27 页、每页 10 条、可按地区/省市筛选；“人工核对记录的分页、数量与总数一致”门禁可落地 |
| airportsdata 许可证 MIT | ✅ | 仓库 README："Released under the MIT License" |
| OurAirports 许可证 Unlicense | ✅ | 仓库 LICENSE / About 面板标注 Unlicense（公共领域奉献） |
| pinyin-pro@3.29.4（MIT） | ✅ | npm registry dist-tags：latest = 3.29.4，该版本存在 |
| 六条换算常数 | ✅ | `1 ft = 0.3048 m`、`1 NM = 1.852 km`、`1 kt = 1.852 km/h`、`1 inHg = 33.8638866667 hPa`、`1 lb = 0.45359237 kg`、`°F = °C × 9/5 + 32`，均与 SI 定义一致 |
| 无 CI、无 `.ai/`、无拼音搜索、无单位换算页 | ✅ | 全仓核查：无任何 CI 配置；`src/` 无 converter/pinyin 实现；搜索仅匹配 IATA/ICAO/中文名/城市 |
| `DB_UPDATE_BASE_URL` 为空、更新入口隐藏 | ✅ | `app/src/config.ts`；设置页更新按钮条件渲染 |
| 数据构建本地、离线、可重复 | ✅ | `airport-data/build.js` 仅 require fs/path，读仓库内 `data-*.json`，无网络代码 |
| 搜索归一化现状（trim＋小写、上限 50） | ✅ | `app/src/utils/airportSearch.ts` |
| 微信产物 < 2 MiB 目标可行 | ✅ | 当前主包约 400KB；补 33 家机场与拼音字段的预估增量约 150KB，仍在限内 |
| versionCode 102/110/111 与数据版本 2026.9.2/2026.9.3 编号衔接 | ✅ | 当前 101 与 2026.9.1，编号连续且符合 build.js 的 `YYYY.M.N` 正则 |
| 补齐缺口的内部一致性（237＋33 = 270） | ✅ | 519 条中 `country=中国` 247 条（含港澳台 10），内地 237，与公报 270 差 33，README/评审/整改记录三处口径一致 |

## 3. 发现的问题与整改

### 3.1 事实性错误（1 处）

**P1｜§3.2 airportsdata 获取方式写“安装明确版本”。**
该数据集只发布 PyPI 包（Python）与原始 CSV，**没有 npm 包**；本项目构建环境为 Node，不应引入 Python 依赖。
整改：§3.2 该行改为“下载发布方公开 CSV 原文件并登记 SHA-256”，并加注说明。

### 3.2 实质遗漏（3 处，影响正确性）

**P2｜数据契约放宽未覆盖在线更新校验。**
§4.3 要求 lat/lng/tz 及英文名等字符串字段可选化，但 `app/src/utils/updater.ts` 的 `validateAirportData` 目前与 build.js 一样硬性必填这些字段，且 `app/tests/updaterValidate.test.ts` 锁定旧契约。不同步放宽，符合新契约的数据包会被在线更新校验拒绝。
整改：§4.3 增补同步修订条款；§4.6 验收清单增加对应验收项。

**P3｜既有数量门禁的迁移未说明。**
`airport-data/build.js` 现门禁为 `cnCount >= 240`（`country=中国`，把港澳台 10 条也计入）与 `total >= 500`；`app/tests/airportsData.test.ts` 断言同款。改为 270 精确门禁时这两处都要改写，且需澄清“改写断言”不违反“不减少既有 89 项测试”的表述。
整改：§4.2 增补门禁迁移说明。

**P4｜数量口径拆分后的文案同步缺失。**
README 与设置页现口径为“已收录 519 家（中国 247，含港澳台 10 条）”。拆出“内地 270 门禁”后，两处数量表述及 README 已知边界声明需同步更新；计划原文只提了设置页覆盖数展示。
整改：§4.4 增补口径拆分与文案更新条款。

### 3.3 模糊与风险标注（5 处）

**P5｜原始上游文件是否入 git 未明确。**
两个开源数据集的原始 CSV 合计数 MB。决策（默认，可推翻）：**不入 git**；来源登记表记录 URL、文件名、访问日期、SHA-256。入库存放的是含 `caacRef` 的转换后源数据（`airport-data/data-*.json` 及核对产物），其上游由登记哈希复现验证。
整改：§3.3 增补说明，并澄清 §3.1“已进入仓库的数据”的所指。

**P6｜CI 类型检查范围名不副实。**
`vue-tsc` 的 tsconfig include 仅 `src/**`，`tests/` 不在类型检查范围内。
整改：§4.5 注明，并要求本版本将 `tests/` 纳入。

**P7｜v1.1.1 时区偏移的运行时依赖风险。**
微信小程序 iOS 端 JavaScriptCore 的 `Intl` 时区支持不完整，`UTC±HH:MM` 偏移不能依赖运行时 `Intl`。
整改：§6.4 增补“构建期时区偏移查表”的实现约束。

**P8｜iOS 真机验收的外部依赖未标注。**
iOS 候选包签名/安装依赖 Apple 开发者账号与证书，v1.0.2 退出条件的可行性系于此前提。决策（默认，可推翻）：写成双分支——有账号照原计划执行；未就绪时降级为 APP 资源构建＋iOS Safari/H5 真机验证，原生真机验收延后并记录。
整改：§1 增补边界条款，§4.7 加执行提示。

**P9｜与界面极简规则的一致性注记。**
V1.0.1 期间确立的规则：数据来源只放裸地址且不上首页、字段完整率不上界面。v1.0.2 在设置页新增民航局为第三来源（用途＝人工核对）并展示 270/270 覆盖，属可信度整改的有意演进，与规则不冲突；完整率仍不上界面。
整改：§4.4 加注。

## 4. 修订落地

以上 9 项（P1–P9）已全部就地修订进 `docs/AeroTools-路线A-v1.0.2至v1.1.1-迭代计划.md`，文档头部已加修订记录行。本次整改仅涉及上述两份文档，不含代码与数据变更，不创建 Git 提交。

## 5. 参考来源

- [《2025年全国民用运输机场生产统计公报》发布（民航局）](http://www.caac.gov.cn/XWZX/MHYW/202602/t20260227_230131.html)
- [2025年全国民用运输机场生产统计公报（原文）](https://www.caac.gov.cn/PHONE/XXGK_17/XXGK/TJSJ/202602/t20260226_230119.html)
- [民航局运输机场名录（截至 2025-12-31）](https://www.caac.gov.cn/GYMH/MHGK/MYJC/)
- [mborsetti/airportsdata（MIT，PyPI＋CSV，无 npm 包）](https://github.com/mborsetti/airportsdata)
- [davidmegginson/ourairports-data（Unlicense）](https://github.com/davidmegginson/ourairports-data)
- [pinyin-pro npm registry（latest = 3.29.4）](https://registry.npmjs.org/pinyin-pro)
