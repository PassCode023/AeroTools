# AeroTools 航枢

面向机长/副驾驶的航前准备工具：**时间计算 + 机场查询**，核心功能完全离线可用。机场数据库内置离线包，预留在线更新通道（当前版本未配置更新服务，更新入口自动隐藏）。

一套代码（uni-app Vue 3 + TypeScript）同时产出：

| 平台 | 状态 | 说明 |
|---|---|---|
| 微信小程序 | ✅ 可构建 | `npm run build:mp-weixin`，主包约 400KB |
| Android / iOS APP | ✅ 可构建 | HBuilderX 云打包（见下文） |
| H5 | ✅ 可构建 | 预览/演示用 |

## 功能

- **时间计算**：时刻/时长加减、多步连续运算、分钟精度、连续数字输入自动格式化（键入 `1425` → `14:25`）、小时可超 23（时长）、跨午夜双显示（累计 + 次日/前日时刻）、负结果双显示（数学结果 + 跨日读数）、任意状态退格纠错与一键清空、本地历史记录 50 条
- **机场查询**：已收录 519 家机场（中国 247 条记录，含港澳台 10 条；覆盖缺口见「已知边界」），IATA/ICAO/中文机场名/中文城市名实时搜索，详情含坐标/时区/海拔与数据来源、资料截至日期
- **数据溯源**：数据来源（两个上游仓库地址）在设置页展示，资料截至日期在首页与设置页展示
- **数据库更新通道**：检查 manifest 版本 → 提示确认 → 下载 → 逐字段结构校验 → 原子写入本地（meta 为提交点，失败自动保留旧库）；`config.ts` 未配置更新服务时更新入口自动隐藏
- **界面**：浅色/深色双主题（设置页切换），参考 uiverse/galaxy 风格语言；交互控件使用按钮语义并满足对比度要求

## 数据来源

机场数据综合整理自以下开源数据集（在首页数据库卡片、机场详情、设置页均有署名）：

- [mborsetti/airportsdata](https://github.com/mborsetti/airportsdata)（MIT License）
- [davidmegginson/ourairports-data](https://github.com/davidmegginson/ourairports-data)（OurAirports，Unlicense/公有领域）

资料整理截至日期与字段完整率记录在 `app/src/dbversion.json`（由 `airport-data/build.js` 生成）；数据仅供参考，以官方 AIP 为准。

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
│  └─ tests/               # vitest 单测（89 个）
├─ airport-data/           # 数据工程
│  ├─ data-*.json          # 机场源数据（按区域分文件）
│  ├─ build.js             # 合并 → 校验 → 产出内置包与部署包
│  └─ dist/                # 远端更新部署产物（manifest + 数据包）
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
node build.js 2026.9.1   # 校验并产出：app/src/static/airports.json + dist/ 部署包
```

校验规则：IATA/ICAO 格式与全局唯一、必填字段、坐标范围、中国机场 ≥240、总数 ≥500。校验不过则构建失败。

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

- **中国机场覆盖存在缺口**：截至 2025 年底民航局公布境内颁证运输机场 270 个（不含港澳台），本库中国记录 247 条（含港澳台 10 条，内地 237 条），至少缺 33 家（邢台褡裢、奇台江布拉克等）；完成官方清单对账前不宣称"全覆盖"
- **海拔字段完整率仅 9%**：49/519 条有海拔，其余缺失以空白展示（不冒充真实资料）；完整率统计记录在 `dbversion.json`，应用界面不展示
- 少数小型机场的 ICAO/IATA 代码基于公开资料整理，个别存疑处留空处理；上线前建议按官方 AIP 抽查
- 全球机场收录为主要机场（272 家），如需扩充在 `airport-data/data-*.json` 增补后重新构建即可
- 在线更新依赖配置 `config.ts` 的 `DB_UPDATE_BASE_URL`（当前为空，入口隐藏）；SHA-256 摘要校验待真实更新服务联调时一并启用
- APP 打包（APK/IPA）需 HBuilderX 与相应开发者账号，本仓库交付源码与配置

## 测试

```bash
cd app && npm run test
```

- `timeMath`：跨午夜加减、负值双解读、>23h 时长、多步链、非法输入
- `calcInput`：输入状态机（首次输入后纠错/清空、运算约束、非法组合防御）
- `airportSearch`：IATA/ICAO/中文名/城市、大小写、排序、截断
- `airportsData`：内置数据契约（唯一性/必填/范围/数量）+ 溯源字段与完整率契约
- `dbUpdate`：数据库原子写入（中途失败保留旧库、块数收缩清理、v1 迁移）
- `updaterValidate`：下载数据逐字段结构校验
