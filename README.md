# 苏州高中目标查询助手

本仓库是微信小程序本地数据型工具，用于查询苏州高中阶段学校基础信息、查看官方来源可核验的历史录取分数线、按固定历史分差区间进行目标参考、对比学校，并在本机记录成绩与阶段学习目标。

## 当前状态

- 版本号：1.6.0
- 正式学校数据：55 条
- 历史录取分数线：146 条
- 数据核对日期：2026-07-09
- 当前已收录 2025、2026 年官方历史分数线：是
- 2026 年仅录入官方图片核验且能匹配现有 schoolId 的记录
- `project.config.json` 已写入 AppID：`wx17e903f81714736f`
- 不写入 AppSecret，不提交账号、密码、token、cookie 或其他密钥

## 当前功能

- 首页展示中考倒计时、产品功能、数据概况和必要免责声明；目标年份只保存在本机
- 学校库名称/别名搜索，以及区域、类型、办学性质、正式标签和分数线状态组合筛选
- 学校详情展示基础信息、历史分数线、来源说明和安全提示；HTTPS 官方来源可在受控页面打开，并保留复制回退
- 成绩分析按固定历史分差区间展示冲刺、匹配、稳妥三类目标参考；每校使用不晚于目标年份的最新已收录年份最高参考分
- 高中对比支持同时选择 2 至 3 所学校，核对地区、类型、标签、历史分数线、地址和收藏状态
- 成绩趋势支持最多 100 条本机记录，并展示最近 12 条变化
- 本地收藏、取消收藏、失效收藏 ID 自动清理及失败重试
- 阶段学习目标支持冲刺、目标、保底三个本地等级，以及记录、删除、清空和草稿
- 学习目标总分上限已统一按苏州中考满分 740 分处理
- 数据说明、隐私说明、我的页本地数据管理

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
- 新增 `pages/score-trend`：成绩记录最多保存 100 条，趋势图展示最近 12 条，数据不上传。
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
4. 依次测试成绩分析的 0/740/741 边界、2～3 所学校对比、成绩趋势新增/删除/清空，以及学习目标等级和草稿恢复。
5. 我的页应展示收藏、学习目标、成绩记录、目标年份、数据说明、隐私说明和清除本地数据。
6. 如仍看到旧文案，优先检查是否打开了旧项目路径、是否未重新编译、是否命中了微信开发者工具缓存。
7. 官方来源页需要在微信公众平台配置对应 HTTPS 业务域名；未配置时应出现明确失败提示，仍可复制链接用系统浏览器打开。

完整人工检查步骤见 [docs/manual_wechat_release_checks.md](docs/manual_wechat_release_checks.md)，本轮升级结果见 [docs/final_rc6_upgrade_report.md](docs/final_rc6_upgrade_report.md)，双端数据结果见 [docs/cross_platform_consistency_report.md](docs/cross_platform_consistency_report.md)。

## 回滚方式

```bash
cd /Users/tom/Dev/suzhou_highschool_miniprogram
git revert <本轮 commit hash>
```

审核结果以微信公众平台为准。本仓库准备完成不等于保证审核通过。
