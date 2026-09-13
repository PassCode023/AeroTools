# AeroTools 民航工具箱

面向机长/副驾驶的航前准备工具：**时间计算 + 机场查询**，核心功能完全离线可用，机场数据库支持在线更新。

一套代码（uni-app Vue 3 + TypeScript）同时产出：

| 平台 | 状态 | 说明 |
|---|---|---|
| 微信小程序 | ✅ 可构建 | `npm run build:mp-weixin`，主包约 400KB |
| Android / iOS APP | ✅ 可构建 | HBuilderX 云打包（见下文） |
| H5 | ✅ 可构建 | 预览/演示用 |

## 功能

- **时间计算**：时刻/时长加减、多步连续运算、分钟精度、连续数字输入自动格式化（键入 `1425` → `14:25`）、小时可超 23（时长）、跨午夜双显示（累计 + 次日/前日时刻）、负结果双显示（数学结果 + 跨日读数）、本地历史记录 50 条
- **机场查询**：519 家机场（中国 247 家全覆盖 + 全球主要机场），IATA/ICAO/中文机场名/中文城市名实时搜索，详情含坐标/时区/海拔
- **数据库在线更新**：检查 manifest 版本 → 提示确认 → 任意网络下载 → 校验 → 分块写入本地；失败自动保留旧库
- **界面**：浅色/深色双主题（设置页切换），参考 uiverse/galaxy 风格语言

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
│  └─ tests/               # vitest 单测（57 个）
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

- 少数小型机场的 ICAO/IATA 代码基于公开资料整理，个别存疑处留空处理；上线前建议按官方 AIP 抽查
- 全球机场收录为主要机场（272 家），如需扩充在 `airport-data/data-*.json` 增补后重新构建即可
- APP 打包（APK/IPA）需 HBuilderX 与相应开发者账号，本仓库交付源码与配置

## 测试

```bash
cd app && npm run test
```

- `timeMath`：跨午夜加减、负值双解读、>23h 时长、多步链、非法输入（52 用例）
- `airportSearch`：IATA/ICAO/中文名/城市、大小写、排序、截断
- `airportsData`：内置数据契约（唯一性/必填/范围/数量）
