# PRELAUNCH-FINAL-MP 执行计划

## 执行身份与边界

- 开始 HEAD：`af259e8ecffe96b47457a2f44c3a13e41954943f`
- 开始 `origin/main`：`af259e8ecffe96b47457a2f44c3a13e41954943f`
- 正式分支：`main`
- 正式名称：苏程记录
- 正式 AppID：`wxc2a2a94f767438dd`
- 当前冻结状态：`V1_CODE_FREEZE_READY`
- 目标状态：`FIRST_SUBMISSION_CODE_READY`；真机、扫码、真实文件发送、体验版上传或审核未完成时使用 `FIRST_SUBMISSION_CODE_READY_PENDING_REAL_DEVICE_ACCEPTANCE`
- Flutter 仓库只作为历史上下文，不修改、不暂存、不提交，也不声称已同步。
- 本轮不新增业务功能、主导航、用户实体、Schema、备份或恢复点格式、历史分差算法、权限、云能力和正式 2027 数据。

## 阶段与检查 ID

| 阶段 | 检查 ID | 内容 | 通过证据 |
| --- | --- | --- | --- |
| P0 | `P0-GIT-GATE`、`P0-CONCURRENCY`、`P0-REMOTE-GATE`、`P0-BACKUP`、`P0-START-BRANCH` | 仓库、分支、基线、并发、远端、仓库外快照、开始保护分支 | Git 输出、备份 manifest、远端分支 |
| P1 | `P1-FREEZE-EVIDENCE`、`P1-PLAN` | 冻结证据、生命周期、测试矩阵、正式入口与单一数据流 | 证据审计和本计划 |
| P2 | `P2-IDENTITY`、`P2-V1-BASELINE`、`P2-HISTORICAL-BASELINE`、`P2-DATA-BASELINE` | 名称/AppID、103 个 TEST-ID、全部 verify、smoke、语法/JSON、正式数据哈希 | 自动测试日志 |
| P3 | `P3-DEVTOOLS-IDENTITY`、`P3-COMPILE`、`P3-PROBLEMS`、`P3-CONSOLE` | 正确项目、普通编译、Problems、Console | 开发者工具日志和截图 |
| P4 | `CHECK-HOME-001..005`、`CHECK-TABS-001..005`、`CHECK-COMMON-STATES` | 五个主导航、通用页面状态、首页和正式入口 | 页面验收记录和截图 |
| P5 | `P5-USER-STATE-GATE`、`P5-RESTORE-POINT`、`P5-BACKUP-V3`、`P5-BEFORE-CHECKSUM` | 写入前恢复点、备份和 checksum | 安全测试输出和仓库外证据 |
| P6 | `JOURNEY-SCHOOL-SEARCH-001..005`、`JOURNEY-SCHOOL-FILTER-001`、`JOURNEY-SCHOOL-STATE-001`、`JOURNEY-TARGET-001`、`JOURNEY-COMPARE-001` | 搜索、筛选、收藏、候选、标签备注、目标、对比 | UI 与自动契约测试 |
| P7 | `JOURNEY-EXAM-001`、`JOURNEY-TEMPLATE-001`、`JOURNEY-SCHEME-001`、`JOURNEY-RATE-001`、`JOURNEY-TREND-001`、`JOURNEY-ELIGIBILITY-001` | 考试、模板、方案、得分率、趋势、参考资格 | UI 与自动契约测试 |
| P8 | `JOURNEY-REVIEW-001`、`JOURNEY-LOSS-001`、`JOURNEY-MISTAKE-001`、`JOURNEY-TASK-001`、`JOURNEY-WEEK-001`、`JOURNEY-STAGE-GOAL-001`、`JOURNEY-STAGE-REVIEW-001` | 学习闭环 | UI 与自动契约测试 |
| P9 | `JOURNEY-HISTORICAL-GAP-001` | 合格考试、情景成绩、分组边界、免责声明 | UI 与算法测试 |
| P10 | `JOURNEY-PROFILE-ISOLATION-001`、`JOURNEY-PROFILE-RESTORE-001` | 两档案隔离、共享收藏、删除和恢复 | 隔离测试 |
| P11 | `JOURNEY-BACKUP-001`、`JOURNEY-IMPORT-001`、`JOURNEY-RESTORE-POINT-001`、`JOURNEY-REPORT-001` | Backup v3、v2 兼容、恢复点、四类报告、主动分享边界 | Fake adapter、UI 与恢复测试 |
| P12 | `JOURNEY-STARTUP-RECOVERY-001` | 12 种启动恢复状态 | MemoryStorage/FakeFaultInjector 测试 |
| P13 | `SIZE-320`、`SIZE-375`、`SIZE-390`、`SIZE-414`、`SIZE-430`、`SIZE-IPAD` | 页面布局、键盘、安全区、长文本、横屏和大字号基本可用性 | 截图和尺寸记录 |
| P14 | `P14-COPY`、`P14-PRIVACY`、`P14-SHARE`、`P14-DISABLED-CAPABILITIES` | 禁用文案、产品边界、隐私和主动分享 | 扫描与页面复核 |
| P15 | `P15-UPLOAD-PACKAGE` | 包文件、体积、必需文件、开发资料排除 | 上传包清单 |
| P16-P19 | `PRELAUNCH-DEFECT-*`、`P17-RESTORE`、`P18-FULL-REGRESSION`、`P19-DEVTOOLS-RECHECK` | 最小修复、专项测试、完整恢复、最终自动与开发者工具复验 | 缺陷记录、checksum、最终日志 |
| P20-P22 | `P20-EVIDENCE`、`P21-COMMIT-PUSH`、`P21-FINAL-BRANCH`、`P22-GIT-GATE` | 文档、机器证据、普通 push、最终保护分支和状态判定 | 最终报告与 Git 输出 |

## 正式页面与开发者工具路径

- 五个 Tab：`pages/home/home`、`pages/schools/schools`、`pages/score-trend/score-trend`、`pages/targets/targets`、`pages/profile/profile`。
- 核心子页：学校详情/筛选/对比、考试设置、复盘与错题区、全局搜索、档案管理、备份恢复、恢复点、数据管理、报告、帮助、数据说明、隐私说明。
- 开发者工具先确认当前打开目录为 `/Users/tom/Dev/suzhou_highschool_miniprogram`，再进行普通编译、Problems、Console、页面和尺寸验收。

## 临时数据与恢复策略

1. 先只读检查开发者工具 Storage；无法确认或无法安全导出时，不写入现有模拟器数据。
2. 可安全访问时，通过正式服务创建 `before_prelaunch_acceptance` 完整恢复点，回读并校验 payload/checksum，再导出并校验 Backup v3。
3. 记录完整用户状态 checksum、activeProfileId、档案和实体数量到仓库外 `acceptance_data/`。
4. 只有三项校验全部成功才创建“上架验收A/B”，且只走正式 OperationContext、幂等和操作锁。
5. 验收结束用原恢复点执行正式恢复；`afterAcceptanceChecksum` 必须等于 `beforeAcceptanceChecksum`。不一致时保留全部证据并停止继续写用户数据。
6. 启动故障注入仅使用 MemoryStorage、正式隔离测试存储和 FakeFaultInjector，绝不破坏真实 Storage。

## 屏幕、文案、包与缺陷策略

- 尺寸：320、375、390、414、430 和 iPad 代表尺寸；最终复验至少覆盖 320、390、430 和 iPad。
- 文案扫描同时覆盖 WXML、页面 JS 提示、帮助、隐私、数据说明、报告和分享确认；历史技术文档命中单独分类，不盲改。
- 上传包按 `project.config.json > packOptions.ignore` 计算文件数、字节数、最大文件/目录和必需运行文件；不执行体验版上传。
- 缺陷使用 `PRELAUNCH-DEFECT-001` 起编号，只修复真实编译、运行、数据、交互、适配、文案、隐私和包问题；不顺带重构或加功能。

## 验证、提交与回滚

- 基线和最终回归：`verify_v1_full.js --all-verify`、两个 smoke、全仓 JavaScript 语法、全仓 JSON、上传包、生成规则一致性、身份、禁用能力、正式数量及 raw/semantic SHA-256、`git diff --check`。
- 每笔提交前更新进度、运行专项与受影响回归、检查正式语义哈希；仅按明确路径暂存。
- 逻辑提交依次为开始验收文档、真实缺陷修复（如有）、候选验证、最终证据；每笔普通 push。远端变化时停止，不 merge/rebase/force。
- 回滚只允许普通 `git revert <commit-sha>`；开始保护分支为 `backup/prelaunch-final-start-20260801-af259e8`，最终保护分支在最终证据提交后创建。

## 人工与平台边界

- 微信账号登录、扫码、真实手机、真实微信聊天文件发送、体验版上传、提交审核和审核结果只在真实完成时计为通过。
- 本轮不会代替用户登录、扫码、上传或提交审核；这些事项不会掩盖编译、路由、白屏、数据或普通交互缺陷。
- 最终状态严格依据最终 HEAD 的真实自动、开发者工具、数据恢复、上传包和 Git 证据判定。
