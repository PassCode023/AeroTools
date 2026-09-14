# 数据源与更新 SOP（机场数据库）

> 适用：`airport-data/` 数据工程。基线：v1.0.2（境内运输机场 270/270 对账完成、`caacRef` 门禁上线）。
> 合规前提：全部条款服从《路线 A 迭代计划》§3.1/§3.2——构建、测试、CI 完全离线，只有维护者本机人工触发 `tools/fetch.js` 时访问网络。

## 1. 三源定位与信任矩阵

三源冲突不按整体排序，按字段分维度裁定（实现于 `airport-data/tools/arbitrate.js`，本表与其一一对应）：

| 字段 | 优先级（高→低） | 依据 |
|---|---|---|
| nameZh 官方中文名 | caac → manual | 民航局名录是境内机场名称的法源；更名必须名录确认后旧名进 `aliases` |
| cityZh / country | manual → caac | 名录只有省份无城市；中文国名是人工整理约定 |
| province / region | caac | 仅名录提供（境内运输机场归属） |
| icao | caac → ourairports → airportsdata | 名录现不发布代码，caac 为政策位；ICAO 基线是 OurAirports |
| iata | caac → airportsdata → ourairports | airportsdata 的新码/改码经 IATA 官方查询、AIP 验证 |
| nameEn / cityEn / lat / lng / elevM | ourairports → airportsdata | OurAirports 日更+社区纠错；airportsdata 自述海拔"经常是错的" |
| tz | airportsdata → ourairports | 仅 airportsdata 有 IANA 时区字段 |

补充规则：

- **去重键**：ICAO → IATA → 规范化(英文名|国家)。同一机场多源记录必须落同一键。
- **manual**（`data-*.json` 现值）是已核基线：上游只有在其字段缺位或官方名录给出更高权威事实时才改写它；任何差异都必须人工确认后才回填，脚本永不自动改数。
- **空值即缺省**：无法从许可清晰的来源确认的字段保持键缺省，禁止猜测或伪造零值。

## 2. 各源抓取逻辑

### 2.1 OurAirports（`davidmegginson/ourairports-data`，Unlicense）

- 文件：`https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv`（约 12.7MB / 86,076 行，含全球关闭机场、直升机场、水上机场）
- 频率：发布方**每日**转储；本项目建议**每季度**刷新一次，或名录/航司公告触发时
- 抓取：`node tools/fetch.js ourairports` —— 下载至 `raw/`、计 SHA-256、自动改写 `SOURCES.md` 对应节并追加下载日志
- 复现验证：`node tools/fetch.js --check`（不联网，校验 `raw/` 文件哈希/行数与登记一致）

### 2.2 airportsdata（`mborsetti/airportsdata`，MIT）

- 文件：`https://raw.githubusercontent.com/mborsetti/airportsdata/main/airportsdata/airports.csv`（约 3MB / 28,298 行，仅运营中机场）
- 频率：发布方按次发布（非每日）；与 OurAirports 同节奏刷新即可
- 抓取：`node tools/fetch.js airportsdata`
- 独有字段：`tz`（IANA）；差异点：剔除已关闭机场、新码经 IATA/AIP 验证

### 2.3 中国民航局运输机场名录（政府公开信息）

**红线：不下载、不缓存页面、不编写任何网页提取程序**——只允许人工逐页浏览：

- 页面：`https://www.caac.gov.cn/GYMH/MHGK/MYJC/`（第 1 页）+ `index_1.html … index_26.html`（第 2–27 页），每页 10 条，共 270 个境内运输机场（名称/地区/省份三项，无代码无坐标）
- 唯一事实登记文件：`caac-registry.json`（27 页 × 10 条快照 + 公报口径依据）；`caacRef` 格式 `pXXeYY` 是**稳定编号，不随官网页序漂移而变**
- 已知坑：站点 CDN 会新旧快照混杂（2026-09-14 两次独立核对均在 index_5/7/8 附近观测到页序轮转）。核对新快照前先与 `caac-registry.json` 做**集合级**比对（`node tools/caac-xcheck.js <快照>`），集合有差异时禁缓存直读官网仲裁，禁止批量抓取复核
- 交叉验证流程：人工浏览 → 按 `tools/caac-snapshot-2026-09-14.json` 的格式整理快照 → `tools/caac-xcheck.js` 比对 → 集合零差异后，在 `caac-registry.json` notes 与 `SOURCES.md` 处理结论各记一行

## 3. 标准更新循环（runbook）

```
① 刷新上游   node tools/fetch.js                 # 下载两 CSV + 更新 SOURCES.md 登记 + 追加下载日志
② 生成线索   node tools/reconcile.js             # ①章名录覆盖 ②章字段级裁定差异（写 reconcile-report.json）
③ 人工处理   读 reconcile-report.json，逐条确认后手改 data-*.json：
             · 补录：新增机场（含 caacRef，取自 caac-registry 槽位）
             · 更名：官方名录确认 → nameZh 改名录名，旧名 append 到 aliases
             · 回填/纠错：按 §1 矩阵；icao/坐标位移（★）必须另查 AIP/官方情报，禁止只信开源库
④ 名录变更   若有新开/更名：人工浏览名录 → 更新 caac-registry.json（含 source.accessedAt）
             → 集合级 xcheck → 快照/notes/SOURCES.md 记录
⑤ 构建门禁   node build.js <YYYY.M.N> <资料截至> <核验日期>   # caacRef=270、唯一性、空串违规即失败
⑥ 全量测试   cd ../app && npm test && npm run type-check
⑦ 提交       data-*.json / caac-registry.json / SOURCES.md / reconcile-report.json / 产出物一起提交
```

触发信号：新开航公告（民航局新闻/统计局公报）、机场更名公告、IATA 改码通知、`reconcile` 报告显示某机场停航（noUpstreamMatch 增多）、季度例行。

## 4. 文件职责地图（防重复登记）

| 文件 | 角色 | 谁写 |
|---|---|---|
| `data-*.json` | 唯一源数据（含 caacRef/aliases） | 人工（依 ②报告+④名录） |
| `caac-registry.json` | 名录事实登记（法源快照） | 人工浏览后手改 |
| `SOURCES.md` | 来源登记表 + 处理结论 + 下载日志 | 人工维护；fetch.js 自动改写 1/2 节 |
| `tools/caac-snapshot-*.json` | 交叉验证输入快照（非事实源） | 人工浏览整理 |
| `raw/` | 上游原始文件缓存（gitignored） | fetch.js |
| `reconcile-report.json` | 更新线索报告（可再生） | reconcile.js |
| `app/src/static/airports.json` `dbversion.json` `dist/` | 构建产物（勿手改） | build.js |

## 5. 已知待处理队列（2026-09-14 报告，随更新消化）

- 6 条无上游对应（人工核实停航/缺码）：河池金城江、三沙永兴、海西茫崖、且末玉都、若羌楼兰、比什凯克玛纳斯
- ICAO 冲突 3 处（须查 AIP）：秦皇岛北戴河 ZBSD↔ZBDH、长治王村 ZBCP↔ZBCZ、巴彦淖尔天吉泰 ZBYL↔ZBYZ
- 坐标位移（Δ>0.05°）若干：承德普宁、乌兰察布集宁、张家口宁远等——疑旧值为市区/旧场坐标，须官方核实
- 海拔回填候选 465 项、坐标精度升级约 400 项：可分批做，优先高流量机场
