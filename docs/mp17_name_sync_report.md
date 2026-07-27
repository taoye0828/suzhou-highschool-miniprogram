# MP17 名称同步报告

## 本轮背景

当前微信小程序正式名称统一为“苏简记录”。本轮只同步品牌名称及相关断言，不改变产品定位、页面功能、正式数据、算法、本地存储或底部导航。

## 起始状态

- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 分支：`main`
- 开始前 HEAD：`2ad0583f7e86e2884ff4799a83d555812aadfcd0`
- 开始前 `origin/main`：`2ad0583f7e86e2884ff4799a83d555812aadfcd0`
- 开始前工作区：干净
- `.git/index.lock`：不存在
- AppID：`wx17e903f81714736f`

## 初始扫描结果

- 旧名称精确命中：12 处
- 旧名称命中文件：11 个
- Unicode 转义形式：0 处
- 新名称：0 处

命中位置按类别如下：

- 运行时与全局配置：`app.js`、`app.json`、`config/app-config.js`
- 项目元数据：`project.config.json`
- README：`README.md`
- 当前与历史文档：`docs/mp12_public_ui_cleanup.md`、`docs/mp1_review_materials.md`、`docs/mp2_review_materials.md`、`docs/mp7_wechat_upload_quick_guide.md`、`docs/rc7_full_upgrade_report.md`
- 验证脚本：`scripts/verify_mp6.js`
- 页面内旧品牌、注释、示例、Unicode 转义：无额外命中

## 修改内容

### 运行时名称与页面标题

- `config/app-config.js` 的正式名称统一为“苏简记录”。
- `app.js` 改为从 `APP_CONFIG.name` 读取全局名称，避免品牌名多处硬编码。
- `app.json` 全局导航标题统一为“苏简记录”。
- 首页导航标题统一为“苏简记录”；学校库、学校详情、成绩分析、目标规划、我的等功能页继续保留各自功能标题。
- 新手教程欢迎标题从统一配置读取当前名称，没有改变教程步骤、路由或状态结构。
- 数据说明页增加当前名称和产品定位说明。
- 隐私说明页增加当前名称，并继续说明本机保存边界。

### 分享标题检查

仓库原本没有 `onShareAppMessage`、`onShareTimeline` 或自定义分享标题处理器，因此本轮没有新增分享功能，也没有改变分享路径或页面参数。全局标题、首页标题和正式平台名称已同步为“苏简记录”，代码中不存在旧品牌分享标题。实际微信分享卡仍需在开发者工具或手机预览中人工确认。

### 配置与元数据

- `project.config.json` 只修改 `description`。
- AppID 保持 `wx17e903f81714736f`。
- `compileType`、`miniprogramRoot`、`packOptions.ignore`、编译设置和项目英文标识均未修改。
- `project.private.config.json` 未修改，且不受 Git 跟踪。
- `sitemap.json` 未修改，索引规则保持不变。
- 仓库不存在 `package.json`。

### README、文档与验证脚本

- README 标题、项目名称和定位统一为“苏简记录”。
- README 当前版本修正为 RC8 `1.8.0`，保留纯本地、无登录、无后台、无 AI、不收集个人身份信息、历史数据仅供参考、55 所学校、146 条分数线和 740 分上限等事实。
- 5 份现存文档中的品牌名统一，未改变历史 SHA、版本数字或历史测试事实。
- `scripts/verify_mp6.js` 的全局标题断言同步为当前名称。
- 新增 `scripts/verify_mp17_name_sync.js`，覆盖名称残留、Unicode 转义、页面标题结构、AppID、数据数量、740 上限、疑似 AppSecret 和云开发能力检查。

## 最终扫描与数据完整性

- 旧名称精确命中：0
- 旧名称明显变体命中：0
- 旧名称 Unicode 转义命中：0
- 新名称命中：20
- 学校：55 所
- 2025 年分数线：103 条
- 2026 年分数线：43 条
- 分数线总数：146 条
- 成绩上限：740 分
- 学校和分数线文件：未修改
- AppID：未修改
- 登录、后台、AI、云开发、外部请求：未新增

## 功能回归与验证

以下检查均通过：

- `project.config.json` 与 `app.json` JSON 解析
- `app.js`、数据文件和全仓运行 JavaScript 语法
- `verify_mp1.js`
- `verify_mp2.js`
- `verify_mp4.js`
- `verify_mp5.js`
- `verify_mp6.js`
- `verify_score_max_740.js`
- `verify_mp13_2026_scores.js`
- `verify_upload_package_ignore.js`
- `verify_rc6_upgrade.js`
- `verify_rc7_1.js`
- `verify_rc7_full.js`
- `verify_rc8.js`
- `verify_mp17_name_sync.js`
- `smoke_local_logic.js`
- `smoke_page_logic.js`
- 跨端一致性 16/16
- `git diff --check`

回归覆盖首页、学校库与“南航”搜索、学校详情、收藏、成绩分析、冲刺/目标/保底推荐、一键加入目标、目标规划、阶段学习目标、高中对比、成绩记录、成绩趋势、`740 / 740 / 650` 折线、中考倒计时、我的、数据管理、新手教程、数据说明、隐私说明及清除本地数据。页面 smoke 中的存储失败日志来自故意注入的失败分支，脚本最终结果为 PASS。

## 微信开发者工具结果

- 微信开发者工具进程已存在，但进程存在不能替代编译验收。
- Computer Use 两次读取应用界面均超时，未取得可验证的 Problems、Console 或模拟器内容。
- 官方 CLI 尝试打开当前项目时返回“服务端口已关闭”。
- 本轮没有擅自修改开发者工具安全设置，没有执行登录、预览、体验版上传或审核。
- 待人工确认：重新编译、Problems 为 0、Console Errors 为 0、首页与功能页标题、数据说明、隐私说明、新手教程、默认分享卡和手机预览。

## Git、备份与回滚

- 仓库外备份：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/MP17_NAME_SYNC_20260727_222419`
- 备份包含本轮涉及的根文件和 `pages`、`components`、`utils`、`config`、`docs`、`scripts`，不包含 `.git`、依赖或构建缓存。
- 提交前状态：仅包含 MP17 预期修改与两个新增文件，无仓库内备份。
- 提交和远端同步状态：以本轮最终执行结果为准。
- 安全回滚：提交后使用 `git revert <MP17 commit hash>`；如需逐文件人工核对，可参考仓库外备份。

## 剩余风险

自动脚本不能证明微信开发者工具模拟器、手机预览或真实分享卡的最终显示。完成上述人工检查前，不应把平台编译、预览或体验版上传标记为已完成。
