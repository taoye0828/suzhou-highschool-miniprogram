# FINAL-RC4 微信小程序完成矩阵

基线：`753a78d1ca0fe266b95b50200782c5217a7ea532`。初始状态依据 2026-07-12 对当前 `main` 的代码审计和全量现有脚本实跑结果填写；状态将在本轮收口时更新。

| 任务编号 | 模块 | 具体任务 | 初始状态 | 代码证据 | 测试证据 | Git 证据 | 当前缺口 | 本轮动作 | 完成提交 | 最终状态 | 最终证据 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RC4-MP-CONFIG-01 | 配置 | AppID、compileType、miniprogramRoot | COMPLETED_VERIFIED | `project.config.json` | `verify_upload_package_ignore.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-CONFIG-02 | 配置 | 页面、tabBar、四件套与事件绑定 | COMPLETED_VERIFIED | `app.json`、`pages/**` | `verify_mp4.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-CONFIG-03 | 配置 | 上传包排除开发资料且保留运行目录 | COMPLETED_VERIFIED | `project.config.json` | `verify_upload_package_ignore.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-CONFIG-04 | 配置 | 私有配置、密钥、构建和 IDE 文件忽略 | PARTIAL | `.gitignore` | 人工审计 | `753a78d` | 缺少发布产物及证书类 ignore | 补充 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-DATA-01 | 数据 | 55 条正式学校、ID 唯一和来源字段 | COMPLETED_VERIFIED | `data/schools.js` | `verify_mp4.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DATA-02 | 数据 | 146 条分数线、ID 唯一和引用有效 | COMPLETED_VERIFIED | `data/admission-scores*.js` | `verify_mp5.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DATA-03 | 数据 | 2025=103、2026=43、分数不超过 740 | COMPLETED_VERIFIED | `data/admission-scores*.js` | `verify_mp13_2026_scores.js`、`verify_score_max_740.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DATA-04 | 数据 | 双端字段、ID、数量与哈希一致性自动检查 | MISSING | 无 | 无 | 无 | 缺少可重跑脚本和报告 | 新增 | 待填写 | MISSING | 待填写 |
| RC4-MP-HOME-01 | 首页 | 正式数据统计由数据文件计算 | COMPLETED_VERIFIED | `pages/home/home.js` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、补断言 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-HOME-02 | 首页 | 学校库、收藏、目标、数据说明入口 | COMPLETED_VERIFIED | `pages/home/home.js`、`.wxml` | `verify_mp4.js` | `753a78d` | 无 | 保留、补路由测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-HOME-03 | 首页 | 数据核对日期、本地保存边界、历史分数线声明 | PARTIAL | `config/app-config.js` | 人工审计 | `753a78d` | 配置存在但首页未完整渲染 | 补充 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-SCHOOL-01 | 学校库 | 正式名称、别名和首尾空格搜索 | COMPLETED_VERIFIED | `utils/school.js` | `smoke_local_logic.js` | `753a78d` | 缺少空词和 trim 显式断言 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-SCHOOL-02 | 学校库 | 地区、类型、性质、分数线状态组合筛选 | COMPLETED_VERIFIED | `utils/school.js` | `smoke_local_logic.js` | `753a78d` | 无 | 保留、补组合断言 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-SCHOOL-03 | 学校库 | 仅展示实际数据支持的筛选项 | PARTIAL | `pages/schools/**` | 人工审计 | `753a78d` | 全部学校无住宿字段但仍展示住宿筛选 | 修复 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-SCHOOL-04 | 学校库 | 重置、结果数、无结果状态、详情入口 | COMPLETED_VERIFIED | `pages/schools/**` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、补断言 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-SCHOOL-05 | 学校库 | 收藏状态即时更新 | COMPLETED_VERIFIED | `pages/schools/schools.js` | `smoke_page_logic.js` | `753a78d` | 页面测试未显式断言 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DETAIL-01 | 学校详情 | 非法 schoolId 与无分数线正式空状态 | COMPLETED_VERIFIED | `pages/school-detail/**` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、补空分数测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DETAIL-02 | 学校详情 | 年份降序且批次、项目、多记录不合并 | COMPLETED_VERIFIED | `utils/admission-scores.js` | `smoke_local_logic.js` | `753a78d` | 缺少同年多记录断言 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DETAIL-03 | 学校详情 | 已核实字段、来源、同分规则和免责声明 | COMPLETED_VERIFIED | `pages/school-detail/**` | `verify_mp6.js` | `753a78d` | 无 | 保留、补页面断言 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-DETAIL-04 | 学校详情 | 未核实字段隐藏 | PARTIAL | `pages/school-detail/school-detail.wxml` | 人工审计 | `753a78d` | 无住宿字段仍渲染“未展示”行 | 修复 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-DETAIL-05 | 学校详情 | 官方来源、官网、地图搜索词的安全外部交接 | COMPLETED_VERIFIED | `utils/map.js`、`pages/school-detail/**` | `smoke_page_logic.js` | `753a78d` | 微信限制下采用复制交接，需文档说明 | 保留、说明 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-FAVORITE-01 | 收藏 | 添加、取消、ID 去重、本地写入与重进恢复 | COMPLETED_VERIFIED | `utils/storage.js` | `smoke_local_logic.js`、`smoke_page_logic.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-FAVORITE-02 | 收藏 | 损坏存储安全恢复 | COMPLETED_VERIFIED | `utils/storage.js` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-FAVORITE-03 | 收藏 | 无效 schoolId 自动清理 | PARTIAL | `pages/favorites/favorites.js` | `smoke_page_logic.js` | `753a78d` | 当前需用户点击清理 | 改为自动清理并覆盖失败 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-FAVORITE-04 | 收藏 | 空状态和存储失败提示 | COMPLETED_VERIFIED | `pages/favorites/**` | `smoke_local_logic.js` | `753a78d` | 页面失败路径需补断言 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TARGET-01 | 学习目标 | 0、740、负数、小数、空值和 741 校验 | COMPLETED_VERIFIED | `pages/targets/targets.js` | `verify_score_max_740.js` | `753a78d` | 边界页面断言不完整 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TARGET-02 | 学习目标 | 差值与中性学习提示 | COMPLETED_VERIFIED | `pages/targets/targets.js` | `smoke_page_logic.js` | `753a78d` | 缺少三种差值断言 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TARGET-03 | 学习目标 | 草稿自动保存、恢复和清除 | COMPLETED_VERIFIED | `pages/targets/targets.js`、`utils/storage.js` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TARGET-04 | 学习目标 | 记录 schema、唯一 ID、ISO 时间、本地显示、备注 trim | COMPLETED_VERIFIED | `pages/targets/targets.js`、`utils/storage.js` | `smoke_local_logic.js` | `753a78d` | 显式断言不足 | 补测试 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TARGET-05 | 学习目标 | 单条删除、全部清空、二次确认和 100 条上限 | COMPLETED_VERIFIED | `pages/targets/targets.js`、`utils/storage.js` | `smoke_local_logic.js`、`smoke_page_logic.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TARGET-06 | 学习目标 | 损坏记录隔离与越界旧记录清理 | PARTIAL | `utils/storage.js` | `smoke_local_logic.js` | `753a78d` | 741 以上旧记录仍会恢复展示 | 修复 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-TARGET-07 | 学习目标 | 存储失败提示和敏感信息提醒 | COMPLETED_VERIFIED | `pages/targets/**` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-PROFILE-01 | 我的 | 收藏/目标计数、版本、数据日期和本地说明 | PARTIAL | `pages/profile/**` | `smoke_page_logic.js` | `753a78d` | 未展示数据核对日期 | 补充 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-PROFILE-02 | 我的 | 清除收藏、目标、草稿且不删除内置数据 | COMPLETED_VERIFIED | `utils/storage.js`、`pages/profile/**` | `smoke_page_logic.js` | `753a78d` | 无 | 保留、补失败断言 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-PRIVACY-01 | 隐私 | 无登录、身份、定位、支付、广告、推送、统计、AI | COMPLETED_VERIFIED | `config/app-config.js` | `verify_mp6.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-PRIVACY-02 | 隐私 | 不上传收藏、目标、草稿且无后台请求 | PARTIAL | `config/app-config.js` | `verify_mp6.js` | `753a78d` | 运行能力一致，但隐私页需更明确 | 补充文案和断言 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-PRIVACY-03 | 隐私 | 缓存/换设备丢失与历史分数线边界 | COMPLETED_VERIFIED | `config/app-config.js` | `verify_mp6.js` | `753a78d` | 无 | 保留、重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TEST-01 | 测试 | 全部既有静态验证 | COMPLETED_VERIFIED | `scripts/verify_*.js` | 2026-07-12 全量实跑 | `753a78d` | 新功能后需重测 | 重测 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TEST-02 | 测试 | 本地存储和业务逻辑 smoke | COMPLETED_VERIFIED | `scripts/smoke_local_logic.js` | 2026-07-12 实跑 | `753a78d` | 真实缺口需新增覆盖 | 扩展 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TEST-03 | 测试 | 页面行为 smoke | COMPLETED_VERIFIED | `scripts/smoke_page_logic.js` | 2026-07-12 实跑 | `753a78d` | 入口和失败路径覆盖不足 | 扩展 | 待填写 | COMPLETED_NEEDS_RETEST | 待填写 |
| RC4-MP-TEST-04 | 测试 | 微信开发者工具编译与手机预览 | EXTERNAL_BLOCKED | 无 | 自动脚本明确 NOT RUN | 无 | 需开发者工具人工编译和真机 | 编写人工检查清单 | 待填写 | EXTERNAL_BLOCKED | 待填写 |
| RC4-MP-DOC-01 | 文档 | README 当前功能、数据、测试和发布边界 | PARTIAL | `README.md` | 人工审计 | `753a78d` | 缺少 RC4 人工清单入口及最新测试 | 收口 | 待填写 | PARTIAL | 待填写 |
| RC4-MP-DOC-02 | 文档 | 微信发布前人工检查 | MISSING | 无 | 无 | 无 | 缺少 RC4 专用清单 | 新增 | 待填写 | MISSING | 待填写 |
| RC4-MP-DOC-03 | 文档 | 最终覆盖报告 | MISSING | 无 | 无 | 无 | 缺少 | 新增 | 待填写 | MISSING | 待填写 |

