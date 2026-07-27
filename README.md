# 苏程记录

项目名称：苏程记录

项目定位：面向苏州初中学生和家长的高中信息查询、历史分数线参考、成绩记录和目标学校规划工具。

当前版本为 RC8（`1.8.0`）。小程序保持纯本地、无登录、无后台、无 AI、无用户数据上传、无个人身份信息收集，正式数据仍为 55 所学校和 146 条历史分数线（2025 年 103 条、2026 年 43 条），成绩上限仍为 740 分。历史数据仅供参考，不代表未来录取结果。

## RC8 产品体验升级

- 底部导航统一为：首页、学校库、成绩分析、目标规划、我的。
- 收藏、高中对比、成绩趋势、数据说明、隐私说明和数据管理迁移到“我的”中的低频工具入口。
- 目标规划整合“目标学校”和“阶段目标”，保留目标学校、等级、阶段草稿和本地记录能力。
- 成绩分析直接推荐具体冲刺、目标和保底学校，每组最多 5 所，可查看详情或由用户主动加入目标。
- 成绩趋势使用统一排序与绘图模型，最近 10 次列表、统计和折线使用同一批记录，相同分数或相同日期不会合并。
- 新增 7 步游戏式新手教程，首次自动显示，可上一步、下一步、跳过、完成和从“我的”重播。
- 清除全部本地数据移动到“我的 → 数据管理”，并同时重置教程状态。
- 主要页面删除版本宣传、数据概况、使用边界和算法实现卡片；完整口径集中在数据说明页。
- 完整实现和验证记录见 `docs/rc8_full_upgrade_report.md`。

本仓库是微信小程序本地数据型工具，用于查询苏州高中阶段学校基础信息、查看官方来源可核验的历史录取分数线、按固定历史分差区间进行目标参考、对比学校，并在本机记录成绩与阶段学习目标。

## 当前状态

- 版本号：1.8.0
- 正式学校数据：55 条
- 历史录取分数线：146 条
- 数据核对日期：2026-07-09
- 当前已收录 2025、2026 年官方历史分数线：是
- 2026 年仅录入官方图片核验且能匹配现有 schoolId 的记录
- `project.config.json` 已写入 AppID：`wx17e903f81714736f`
- 不写入 AppSecret，不提交账号、密码、token、cookie 或其他密钥

## 当前功能

- 首页可直接输入成绩进入分析，并按“输入成绩 → 分析目标高中 → 选择目标学校 → 记录成绩变化 → 查看提升趋势”完成规划；同时保留数据来源、使用说明和必要免责声明
- 首页、学校库、收藏、目标学校选择、高中对比和成绩分析共用学校智能匹配；支持去空格、大小写归一、名称/别名、顺序字符和分散字符匹配
- 学校详情展示基础信息、历史分数线、来源说明和安全提示；HTTPS 官方来源可在受控页面打开，并保留复制回退
- 成绩分析按固定历史分差区间展示冲刺、匹配、稳妥三类目标参考；每校使用不晚于目标年份的最新已收录年份最高参考分
- 高中对比支持同时选择 1 至 3 所学校，核对目标等级、历史参考分、参考年份、当前成绩和差距
- 成绩趋势支持最多 100 条本机记录，使用原生 Canvas 展示最近 10 次折线，并计算最高分、最低分、平均分和首尾变化
- 本地收藏、取消收藏、失效收藏 ID 自动清理及失败重试
- 学校库新增 4 档历史分数范围和目标类型组合筛选，支持“南航 + 650以上”等组合条件
- 阶段学习目标使用 `sprint / target / safe` 三个本地等级，兼容读取旧 `challenge` 冲刺记录，并支持添加、列表内改级、删除、清空、详情跳转、历史参考目标和当前差距
- 学习目标总分上限已统一按苏州中考满分 740 分处理
- 数据说明、隐私说明、我的页本地数据管理

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
- 本轮未修改 Flutter 仓库；小程序正式数据与本机 Flutter 正式资产的数量、字段和哈希复核通过。
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
node scripts/verify_mp17_name_sync.js
node scripts/verify_mp18_name_sync.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
node scripts/verify_cross_platform_consistency.js ../suzhou_highschool_app
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

## 重新编译检查

1. 关闭并重新打开微信开发者工具中的当前项目，或重新导入 `/Users/tom/Dev/suzhou_highschool_miniprogram`。
2. 点击编译，进入首页和我的页检查正式页面文案。
3. 首页应展示中考倒计时、数据概况和 7 个正式快捷入口。
4. 依次测试成绩分析的 0/650/740/741 边界、1～3 所学校对比和第 4 所拦截、成绩趋势新增/删除/清空/最近 10 次，以及学习目标三个等级。
5. 我的页应展示收藏、学习目标、成绩记录、目标年份、数据说明、隐私说明和清除本地数据。
6. 如仍看到旧文案，优先检查是否打开了旧项目路径、是否未重新编译、是否命中了微信开发者工具缓存。
7. 官方来源页需要在微信公众平台配置对应 HTTPS 业务域名；未配置时应出现明确失败提示，仍可复制链接用系统浏览器打开。

完整人工检查步骤见 [docs/manual_wechat_release_checks.md](docs/manual_wechat_release_checks.md)，RC7-FULL 结果见 [docs/rc7_full_upgrade_report.md](docs/rc7_full_upgrade_report.md)，双端数据结果见 [docs/cross_platform_consistency_report.md](docs/cross_platform_consistency_report.md)。

## 回滚方式

```bash
cd /Users/tom/Dev/suzhou_highschool_miniprogram
git revert <本轮 commit hash>
```

审核结果以微信公众平台为准。本仓库准备完成不等于保证审核通过。
