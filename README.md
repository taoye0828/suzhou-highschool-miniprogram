# 苏程记录

面向苏州初中学生和家长的纯本地高中信息、成绩记录和目标规划工具。当前版本为 RC10（`2.0.0`），不登录、不接后台或云开发、不使用 AI、不上传用户数据。

## RC10 综合升级

- 所有用户数据写入使用事务日志、旧值快照、逐键回读和失败回滚；异常退出后启动时先恢复未完成事务。
- 推荐分段增加当前成绩、下一阶段目标和中考目标三种情景，手动分析值不会改写真实成绩或阶段目标。
- 考试复盘增加 10 类按学科失分原因，可从一条原因创建统一学习任务。
- 学习目标分段融合阶段目标、学习任务、来源复盘、当前/目标成绩、截止日期和状态进度。
- 学校详情增加真实年份逐项目分数线趋势；学校对比支持顺序调整和当前/阶段/中考三种分差。
- 最近浏览与最近操作保持有限本地记录，可单独清除，不记录复盘正文或备注全文。
- 双端备份统一为 `backupFormatVersion = 2`，同时兼容导入 RC9 v1 备份；正式学校和分数线不进入用户备份。
- “我的 → 数据管理 → 数据检查”支持只读扫描、安全修复、修复前快照和恢复。
- 55 所学校内部数据质量矩阵与 2027 年候选数据维护流程已经建立；没有录入或预测 2027 分数线。
- 微信开发者工具 RC `2.02.2607171` 已实际执行“普通编译”；Problems 为 0，首页、学校库、成绩、目标规划、我的五个主 Tab 均完成只读切换检查。预览、体验版上传和审核未执行。
- 完整实现见 [docs/rc10_full_upgrade_report.md](docs/rc10_full_upgrade_report.md)。

## RC9 综合升级

- 五个主导航统一为：首页、学校库、成绩、目标规划、我的。
- 首页只显示倒计时、最近成绩与变化、主要目标学校、当前分差、阶段目标和快捷操作。
- 学校库支持真实区域、学校类型、参考年份、参考分上下限、成绩匹配、收藏、目标等级和排序；同类多选为 OR，跨类组合为 AND。
- 收藏、目标学校、对比、学校详情和“我的”汇总共享同一份本地数据；对比最多选择 3 所正式学校。
- 成绩中心融合记录、趋势和复盘，支持总分、可配置学科、可选排名、复盘文本、复制考试、搜索和日期筛选。
- 成绩趋势和目标差距轨迹共用稳定排序与真实记录数坐标；成绩点、数字、考试名称和日期使用同一个 `point.x`，最近最多显示 10 条但不预留固定十格。
- 目标规划融合推荐、目标学校、主要目标、差距轨迹和阶段学习目标；默认推荐规则保持冲刺 `-30..-1`、目标 `0..15`、保底 `>15`，每类最多 5 所。
- 本地存储升级到 `storageSchemaVersion = 4`，迁移链为 `v1 → v2 → v3 → v4`；迁移幂等，清除后旧数据不会复活。
- 新增纯本地多学生档案、独立或共享收藏、结构化 JSON 备份、校验预览、合并/覆盖恢复和导入前快照。
- 保留首次 7 步教程，并支持按首页、学校筛选、成绩、趋势、目标规划、备份恢复和学生档案分别重播。
- 完整实现和验证记录见 [docs/rc9_full_upgrade_report.md](docs/rc9_full_upgrade_report.md)；趋势热修复证据见 [docs/rc8_chart_vertical_alignment_hotfix_report.md](docs/rc8_chart_vertical_alignment_hotfix_report.md)。

## 当前状态

- 版本号：2.0.0
- 正式学校数据：55 条
- 历史录取分数线：146 条（2025 年 103 条、2026 年 43 条）
- 当前已收录 2025、2026 年官方历史分数线
- 数据核对日期：2026-07-09
- 成绩上限：740 分
- 本地存储版本：4
- `project.config.json` 已写入 AppID：`wx17e903f81714736f`
- 不写入 AppSecret，不提交账号、密码、token、cookie 或其他密钥

## 当前功能

- 首页个人总览、学校库实用筛选、学校详情、收藏和 2 至 3 校对比。
- 成绩记录、总分/学科趋势、确定性个人分析、考试复盘、失分原因和可选排名。
- 三档成绩情景、目标学校分级、主要目标、差距轨迹、阶段目标及学习任务。
- 本地学生档案、档案隔离、收藏模式、备份恢复、数据管理、最近浏览和帮助中心。
- 参考分统一选择不晚于目标年份的最新已收录年份；同校同年多条记录取最高分。
- 正式学校和分数线数据不会从用户备份导入，也不会被本地清除操作修改。

## RC7-FULL 完整升级

- 完成首页成绩入口和 5 步目标规划路径。
- 成绩记录继续纯本地保存，支持新增、查看、删除、清空、重启读取和最多 100 条限制。
- 最近 10 次成绩使用原生 Canvas 折线展示，不引入图表依赖。
- 目标学校绑定 `schoolId + schoolName + level`，统一使用 `sprint / target / safe`。
- 学校库支持名称智能搜索、分数范围、目标类型及原有区域/类型/性质/标签组合筛选。
- 学校详情新增“我的目标分析”卡；高中对比支持 1 至 3 所学校。
- 运行边界保持纯本地、无登录、无支付、无广告、无 AI、无云开发、无后台、无定位。
- 完整实现与验证记录见 [docs/rc7_full_upgrade_report.md](docs/rc7_full_upgrade_report.md)。

## RC7-1 功能增强（RC7-FULL 基线）

- 新增统一搜索服务 `utils/school-search.js`，不再由各页面各写一套学校匹配逻辑。
- 搜索排序固定为：完整名称包含、别名包含、顺序字符匹配、分散字符匹配；`南航`、`十中`、`园区`、带空格关键词和无结果均有自动测试。
- 首页可直接搜索并打开学校详情；收藏、目标学校选择、高中对比和成绩分析均接入相同服务。
- 学校详情继续作为加入目标的正式入口，可选择冲刺、目标或保底；目标列表按三个等级排序，并显示历史参考分、参考年份、我的成绩和当前差距。
- 成绩分析可按学校名称或简称筛选，标识已加入目标的学校，并显示“需要提升 N 分”或已达到历史参考分。
- 本阶段只做功能增强，未执行微信审核、体验版上传、备案或其他发布步骤。
- 完整记录见 [docs/rc7_1_feature_upgrade_report.md](docs/rc7_1_feature_upgrade_report.md)。

## FINAL-RC6 状态

- 小程序本地代码范围已完成并通过自动验证。
- 运行页面共 12 个，其中包括成绩分析、高中对比、成绩趋势 3 个新增页面和 1 个受控官方来源页；tabBar 保持首页、学校库、收藏、学习目标、我的 5 项。
- 双端正式数据文件一致性为 16/16：55 所学校、146 条分数线，2025 年 103 条、2026 年 43 条。
- 微信与 Flutter RC10 备份已经完成双向真实互解析；两端正式数据的数量、字段和哈希继续一致。
- 收藏、学习目标、成绩记录、输入草稿和中考目标年份只保存在当前设备。
- 代码完成不等于微信开发者工具编译、手机预览、备案、体验版上传或平台审核完成。

## MP6-Release-Check 验收状态（2026-07-26）

- Git：验收开始时 `main` 工作区干净，`HEAD` 与 `origin/main` 均为 `e2f36046be16d0493fef624109af87f7bb38675a`。
- 配置：开发者工具打开的项目路径正确，AppID 为 `wx17e903f81714736f`；运行目录未发现 AppSecret、token、password 或密钥形态内容。
- 自动验证：MP1/MP2/MP4/MP5/MP6、740 分上限、2026 分数线、上传包忽略、RC6、逻辑/页面 smoke、全部 JavaScript 语法和双端一致性检查通过。
- 编译状态：微信开发者工具 Stable `2.01.2510290` 已实际打开项目并点击编译，但模拟器因 `INVALID_LOGIN, access_token expired` 启动失败；调试器显示 1 个登录错误、0 个警告，不能记为编译通过。
- 人工测试状态：首页、学校库、学校详情、收藏、目标规划、成绩分析、学校对比、成绩趋势和我的页面均未执行真实模拟器点击验收；脚本验证不能替代人工验收。
- 发布准备状态：上传包静态检查通过，但在重新登录并完成编译、页面验收和手机预览前，不可标记为可上传体验版。

## 当前不支持

- 不登录
- 不获取微信头像昵称
- 不获取手机号
- 不请求定位
- 不接支付
- 不接广告
- 不接推送
- 不接第三方统计 SDK
- 不接云开发
- 不接后台请求
- 不接 AI
- 不做录取预测
- 不提供志愿填报结论
- 不判断学校能否录取

## 数据原则

学校基础信息来自学校官网、教育局官网、政府公开网站等官方公开来源。正式页面只展示已核实字段，未核实字段不进入页面。当前版本收录 2025、2026 年官方历史录取分数线；2026 年仅录入官方公开来源或官方图片核验且能匹配现有 schoolId 的记录。历史录取分数线仅供了解，不代表未来录取结果。

## FINAL-RC6 本地增强升级

- 新增 `pages/target-analysis`：执行固定分差区间分类，边界为 `-30～-1`、`0～15`、`>15`，不输出录取结论。
- 新增 `pages/school-compare`：最多选择 3 所学校，对比字段全部来自正式本地数据。
- 新增 `pages/score-trend`：成绩记录最多保存 100 条；RC7-FULL 已将趋势升级为最近 10 次原生折线，数据不上传。
- 首页新增中考倒计时，默认目标日期为 2027 年 6 月 17 日，目标年份可修改并保存在本机。
- 学习目标新增冲刺、目标、保底三个等级；旧记录缺少等级时按“目标学校”兼容读取。
- “我的”页汇总成绩记录和目标年份；清除本地数据覆盖收藏、目标、草稿、成绩和目标年份。
- 本轮未修改学校和分数线数据，AppID、上传包忽略规则、5 项 tabBar 和 740 分上限保持不变。

## MP12 页面收口

- 用户可见页面已移除开发阶段文案。
- 上传包已通过 `project.config.json` 的 `packOptions.ignore` 忽略 `docs`、`scripts`、`README.md`、Markdown 文档、Git 目录、系统临时文件和常见临时输出目录。
- AppID 已写入 `project.config.json`。
- 数据保持 55 所学校，历史分数线增至 146 条，其中 2025 年 103 条、2026 年 43 条。
- 小程序仍保持不登录、不上传、不定位、不预测。
- 重新编译后，应不再看到“提交前说明”和“MP6 填写 AppID 前最终收口版”。

## MP16 上传包清理

- 开发文档、官方来源证据、验证脚本和审计资料继续保留在 GitHub，便于后续维护和数据溯源。
- 小程序上传包通过 `project.config.json` 的 `packOptions.ignore` 排除 `docs`、`scripts`、`README.md`、Markdown 文档、官方图片缓存、官方页面 HTML 缓存、日志、临时目录、依赖目录和 IDE 配置目录。
- 本轮不直接删除 `docs` 或 `scripts`，因为它们不属于运行时文件，但属于开发维护和官方来源证明资料。
- 运行时入口和目录仍保持为 `app.js`、`app.json`、`app.wxss`、`sitemap.json`、`pages`、`data`、`utils`、`config`、`styles`。
- 数据仍为 55 所学校、146 条历史录取分数线，其中 2025 年 103 条、2026 年 43 条。
- 学习目标满分仍为 740，小程序仍保持不登录、不定位、不支付、不接广告、不接云开发、不接后台请求。

## 本地验证命令

```bash
node -e "JSON.parse(require('fs').readFileSync('project.config.json','utf8')); console.log('project.config.json JSON OK')"
node --check app.js
node --check data/schools.js
node --check data/admission-scores.js
node --check data/admission-scores-2026.js
node scripts/verify_mp1.js
node scripts/verify_mp2.js
node scripts/verify_mp4.js
node scripts/verify_mp5.js
node scripts/verify_mp6.js
node scripts/verify_score_max_740.js
node scripts/verify_mp13_2026_scores.js
node scripts/verify_upload_package_ignore.js
node scripts/verify_rc6_upgrade.js
node scripts/verify_rc7_1.js
node scripts/verify_rc7_full.js
node scripts/verify_rc8.js
node scripts/verify_rc8_chart_vertical_alignment.js
node scripts/verify_mp17_name_sync.js
node scripts/verify_mp18_name_sync.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
node scripts/verify_rc9_full.js
node scripts/verify_rc10_full.js
node scripts/verify_cross_platform_consistency.js ../suzhou_highschool_app
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

## 重新编译检查

1. 关闭并重新打开微信开发者工具中的当前项目，或重新导入 `/Users/tom/Dev/suzhou_highschool_miniprogram`。
2. 点击编译，确认底部五项依次为：首页、学校库、成绩、目标规划、我的。
3. 首页分别检查无数据与有数据状态，不应恢复旧搜索框、成绩输入框或数据宣传卡。
4. 学校库检查搜索、区域/类型多选、年份、参考分、成绩匹配、收藏/目标筛选、重置和无结果清除。
5. 成绩中心录入 740、740、650 三条记录，确认点、数字、名称和日期逐条同 x；再检查编辑、复制、删除、学科和复盘。
6. 目标规划检查默认推荐、加入目标不重复、主要目标、差距轨迹和阶段学习目标。
7. “我的”检查档案切换、备份导出/导入预览、帮助教程、当前档案清除和全部清除二次确认。
8. 在 320、375、390、414、430 宽度和 iPad 模拟尺寸检查表单、筛选、图表、底部对比栏及教程遮罩。
9. 如仍看到旧文案，优先检查是否打开了旧项目路径、是否未重新编译、是否命中了微信开发者工具缓存。
10. 官方来源页需要在微信公众平台配置对应 HTTPS 业务域名；未配置时应出现明确失败提示，仍可复制链接用系统浏览器打开。

完整 RC9 结果见 [docs/rc9_full_upgrade_report.md](docs/rc9_full_upgrade_report.md)，人工发布检查见 [docs/manual_wechat_release_checks.md](docs/manual_wechat_release_checks.md)，双端数据结果见 [docs/cross_platform_consistency_report.md](docs/cross_platform_consistency_report.md)。

## 回滚方式

```bash
cd /Users/tom/Dev/suzhou_highschool_miniprogram
git revert <本轮 commit hash>
```

审核结果以微信公众平台为准。本仓库准备完成不等于保证审核通过。
