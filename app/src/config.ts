/**
 * 机场数据库远端更新配置。
 *
 * 部署方法：把 airport-data/dist/ 下的 manifest.json 与 airports-<版本>.json
 * 上传到任意静态托管（OSS / COS / 自有服务器），把清单目录填到这里，例如：
 *   https://your-oss.example.com/aerotools
 * 留空则不进行在线检查（纯离线使用内置数据库）。
 */
export const DB_UPDATE_BASE_URL = ''

/** APP 版本（与 manifest.json 保持一致） */
export const APP_VERSION = '1.0.2'

/** 意见反馈地址（GitHub Issues，小程序端复制、APP/H5 端直接打开） */
export const FEEDBACK_URL = 'https://github.com/PassCode023/AeroTools/issues'

/** 历史记录保留条数上限 */
export const HISTORY_LIMIT = 50
