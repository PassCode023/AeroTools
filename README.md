# AeroTools 航枢

面向机长/副驾驶的航前准备工具：**时间计算 + 机场查询 + 离线单位换算**，核心功能完全离线可用。机场数据库内置离线包，预留在线更新通道（当前版本未配置更新服务，更新入口自动隐藏）。

一套代码（uni-app Vue 3 + TypeScript）同时产出：

| 平台 | 状态 | 说明 |
|---|---|---|
| 微信小程序 | ✅ 可构建 | `npm run build:mp-weixin`，主包约 850KB |
| Android / iOS APP | ✅ 可构建 | HBuilderX 云打包（见下文） |
| H5 | ✅ 可构建 | 预览/演示用 |

## 功能

- **时间计算**：时刻/时长加减、多步连续运算、分钟精度、连续数字输入自动格式化（键入 `1425` → `14:25`）、小时可超 23（时长）、跨午夜双显示（累计 + 次日/前日时刻）、负结果双显示（数学结果 + 跨日读数）、任意状态退格纠错与一键清空、本地历史记录 50 条
- **机场查询**：已收录 **553 家**机场（境内运输机场 **270/270** 与民航局名录全量对账，含 33 起官方确认更名与 34 家补齐；另含港澳台 10 条与全球主要机场）；支持 IATA/ICAO、中文机场名/城市名、**全拼/拼音首字母（构建期生成，客户端不含拼音库）**、曾用名、英文名/英文城市实时搜索；查询归一化（大小写、全半角、空格、连字符、点号、拉丁重音）；排序按代码精确 > 代码前缀 > 名称精确 > 前缀 > 包含，同分保持库内顺序，最多 50 条；详情含曾用名、**十进制+度分双格式坐标**、**海拔 m/ft 双单位**、**时区 IANA 与当前 UTC 偏移及夏令时提示（构建期偏移查表，不依赖运行时 Intl）**、资料截至日期
- **单位换算**：六组双向离线换算——长度 ft/m、航程 NM/km、速度 kt/km/h、气压 inHg/hPa、质量 lb/kg、温度 ℃/℉；任一侧输入即时更新另一侧，按类别的显示精度舍入，除温度外拒绝负数，无效输入不产生结果
- **数据溯源**：三来源（airportsdata / OurAirports / 民航局名录）及各自用途在设置页展示，并显示"境内运输机场 270/270（截至 2025-12-31）"覆盖状态；资料截至日期在首页与设置页展示
- **数据库更新通道**：检查 manifest 版本 → 提示确认 → 下载 → 逐字段结构校验 → 原子写入本地（meta 为提交点，失败自动保留旧库）；`config.ts` 未配置更新服务时更新入口自动隐藏
- **界面**：浅色/深色双主题（设置页切换），参考 uiverse/galaxy 风格语言；交互控件使用按钮语义并满足对比度要求

## 数据来源

机场数据按 `airport-data/SOURCES.md`（来源登记表：URL、访问日期、许可证、原文件 SHA-256）综合整理自：

- [mborsetti/airportsdata](https://github.com/mborsetti/airportsdata)（MIT License）
- [davidmegginson/ourairports-data](https://github.com/davidmegginson/ourairports-data)（OurAirports，Unlicense/公有领域）
- [中国民航局运输机场名录](https://www.caac.gov.cn/GYMH/MHGK/MYJC/)（政府公开信息，仅人工核对与引用）：270 个境内运输机场官方名称、更名事实与覆盖门禁对账；快照见 `airport-data/caac-registry.json`

资料整理截至日期、人工核验日期、覆盖状态（270/270）与字段完整率记录在 `app/src/dbversion.json`（由 `airport-data/build.js` 生成）；数据仅供参考，以官方 AIP 为准。

三源的信任优先级、抓取方式与季度更新流程见[数据源与更新 SOP](docs/数据源与更新SOP.md)（工具链：`tools/fetch.js` 下载登记 / `tools/reconcile.js` 对账线索 / `tools/caac-xcheck.js` 名录交叉验证 / `tools/arbitrate.js` 字段裁定矩阵）。

## 目录结构

```
├─ app/                    # uni-app 项目（Vue3 + TS + Vite）
│  ├─ src/
│  │  ├─ pages/            # home / time-calc / airport-search / settings
│  │  ├─ components/       # num-keypad 数字键盘
│  │  ├─ utils/            # timeMath / airportSearch / db / updater / theme / storage
│  │  ├─ static/airports.json   # 内置机场数据库（构建产物，勿手改）
│  │  ├─ dbversion.json         # 内置数据库版本（构建产物，勿手改）
│  │  └─ config.ts         # 更新服务地址 / APP 版本
│  └─ tests/               # vitest 单测（104 个）
├─ airport-data/           # 数据工程
│  ├─ data-*.json          # 机场源数据（按区域分文件，含 caacRef/aliases）
│  ├─ caac-registry.json   # 民航局名录人工核对快照（27 页 × 10 条）
│  ├─ SOURCES.md           # 来源登记表（URL/许可证/SHA-256）
│  ├─ tools/               # 更新工具链与迁移脚本（fetch/reconcile/arbitrate/xcheck，离线为主）
│  ├─ build.js             # 合并 → 校验（caacRef=270 门禁）→ 产出
│  └─ dist/                # 远端更新部署产物（manifest + 数据包）
├─ .github/workflows/      # 最小 CI（测试→类型检查→三端构建，离线）
└─ docs/superpowers/specs/ # 设计文档
```

## 开发

```bash
cd app
npm install

npm run dev:h5           # H5 开发服务器
npm run dev:mp-weixin    # 产出小程序开发版 → 微信开发者工具导入 dist/dev/mp-weixin
npm run test             # vitest 单测
npm run type-check       # vue-tsc 类型检查
```

数据集修改后重新生成（在 `airport-data/` 下）：

```bash
node build.js 2026.9.2   # 校验并产出：app/src/static/airports.json + dist/ 部署包
```

校验规则：仅中文名与国家必填（其余字段可选，缺失即键缺省）；IATA/ICAO 存在时格式合法且全局唯一；坐标存在时范围合法；`caacRef` 恰好 270 条且与 `caac-registry.json` 一一对应；中国记录中文名唯一。校验不过则构建失败。

## 发布

### 微信小程序

1. 在 `app/src/manifest.json` → `mp-weixin.appid` 填入你的小程序 AppID
2. `npm run build:mp-weixin`
3. 微信开发者工具导入 `app/dist/build/mp-weixin` → 上传审核
4. 若启用在线更新：在小程序后台把更新服务域名加入 request 合法域名

### Android / iOS APP（HBuilderX 云打包）

1. 用 HBuilderX 打开 `app/` 目录（或新建项目指向该目录）
2. `app/src/manifest.json` → 基础配置获取 DCloud AppID
3. 发行 → 原生 App-云打包：
   - Android：使用公共测试证书或自有证书
   - iOS：需苹果开发者账号与证书/描述文件
4. 应用名称/版本在 `manifest.json` 维护；更新逻辑运行时无需重新打包（数据在线更新）

### 机场数据库更新服务（静态托管）

1. `airport-data/dist/` 下两个文件上传到任意静态托管（OSS / COS / 服务器静态目录）：
   - `manifest.json`
   - `airports-<版本>.json`
2. 把清单所在目录填入 `app/src/config.ts` 的 `DB_UPDATE_BASE_URL`，例如 `https://cdn.example.com/aerotools`
3. 发版后 APP 启动即静默检查，发现新版本弹窗提示用户确认下载（Wi-Fi/移动网络均可）；服务端未配置时完全离线运行

发布新数据集：`node build.js <新版本号>` → 重新上传 `dist/` 两个文件即可，无需发版 APP。

## 已知边界

- **境内运输机场已 270/270 对账**（民航局名录截至 2025-12-31，含 33 起官方确认更名与 34 家补齐）；名录之外的记录（停航的吉林二台子机场、港澳台 10 条）保留在通用库、不计入门禁
- **海拔字段完整率约 93%**：全球多数机场海拔取自权威数据集回填，29 条无可靠实测值，缺失统一显示"—"；完整率统计记录在 `dbversion.json`，应用界面不展示
- 少数小型机场的 ICAO/IATA 代码基于公开资料整理，个别存疑处留空处理（蚌埠滕湖暂无真实 ICAO）；上线前建议按官方 AIP 抽查
- 全球机场收录为主要机场（272 家），如需扩充在 `airport-data/data-*.json` 增补后重新构建即可
- 在线更新依赖配置 `config.ts` 的 `DB_UPDATE_BASE_URL`（当前为空，入口隐藏）；SHA-256 摘要校验待真实更新服务联调时一并启用
- APP 打包（APK/IPA）需 HBuilderX 与相应开发者账号，本仓库交付源码与配置；按迭代计划 2026-09-15 修订口径，Android/iOS 仅要求资源构建（编译）通过，真机验证仅微信小程序

## 测试

```bash
cd app && npm run test
```

- `timeMath`：跨午夜加减、负值双解读、>23h 时长、多步链、非法输入
- `calcInput`：输入状态机（首次输入后纠错/清空、运算约束、非法组合防御）
- `airportSearch`：IATA/ICAO/中文名/城市/拼音/英文/曾用名、归一化、§6.3 排序、50 条截断
- `searchNormalize`：查询归一化（大小写/全半角/空格/连字符/点号/拉丁重音）
- `detailFormat`：度分坐标换算与进位、海拔 m/ft 双单位
- `tzOffset`：构建期时区偏移查表、UTC±HH:MM 格式、夏令时提示、非法时区降级
- `unitConvert`：六类换算双向/零值/负数规则/无效输入/精度/往返误差
- `airportsData`：内置数据契约（270/270 覆盖、结构化 sources、verifiedAt、可选字段合法性、唯一性、无 caacRef、无伪造零值）+ 溯源与完整率契约
- `caacSource`：名录登记表（27 页 ×10、270 唯一）与源数据 caacRef 门禁、官方更名 aliases
- `dbUpdate`：数据库原子写入（中途失败保留旧库、块数收缩清理、v1 迁移）
- `updaterValidate`：下载数据结构校验（与内置契约一致）
- `display`：缺失值降级显示（"—"，真实 0 原样）
