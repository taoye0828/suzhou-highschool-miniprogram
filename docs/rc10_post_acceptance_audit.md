# RC10 后置真实验收审计（RC11-1）

RC10 本地提交 `9e23581..4a4493c` 与报告、diff、现有 18 项门禁一致；工作区开始时干净，本地仅单向领先 `origin/main` 8 个提交。RC10 功能不是模型/测试孤岛：正式五 Tab 与二级页均有入口。

| RC10 声明 | 实际入口/页面 | 实际 Service/存储 | 实际测试 | 状态 | RC11-1 决定 |
|---|---|---|---|---|---|
| 事务写入 | 所有用户写入 | `rc9-storage.atomicWrite` / transactionJournal | RC10 transactional | implemented | 保留 |
| 个人成绩情景 | 目标规划→推荐 | `rc10-features.scenarioResults` / profileData | RC10 scenarios | implemented | 保留 |
| 失分原因 | 成绩→复盘 | storage / scoreLossReasons | RC11 second journey | implemented | 保留 |
| 从复盘创建任务 | 成绩→复盘；目标规划查看 | storage / learningTasks | RC11 second journey | implemented | 修复来源失效提示 |
| 学习目标进度 | 目标规划→学习目标 | `goalProgress` / stageGoals+tasks | RC10 goal progress | implemented | 保留 |
| 目标学校差距 | 目标规划→目标学校 | planning / scores+targets | RC10 gap | implemented | 保留 |
| 学校质量矩阵 | 内部文档 | generator / 无用户存储 | RC10 matrix | implemented | 保留（非页面功能） |
| 学校详情趋势 | 学校详情 | rc10-features / 正式分数数据 | RC10 detail trend | implemented | 保留 |
| 学校对比深化 | 学校库→对比 | planning / profileData | RC10 compare | implemented | 保留 |
| 最近浏览 | 我的 | storage / recentHistory | RC10 recent | implemented | 保留 |
| 跨端统一备份 | 我的→备份与恢复 | backup-restore / 用户字段 | RC10 bridge + RC11 multi-profile | implemented | 保留 |
| 数据检查/修复 | 我的→数据管理 | data-health / repairSnapshot | RC10 health | implemented | 保留 |
| 动态帮助 | 我的 | onboarding/rc10-features | RC10 help | implemented | 保留 |
| 2027 维护流程 | docs/scripts 内部流程 | annual tool；候选不接运行时 | RC10 2027 | implemented | 保留边界 |
| 多设备适配 | 正式页面 | wxss + DevTools | accessibility + 人工待验 | partial（人工宽度未全跑） | 文档如实保留人工验收项 |
| 图表文字摘要 | 成绩趋势 | score-trend | RC8 alignment | implemented | 保留 |

报告与代码不一致项：RC10 报告把旧键回退兼容描述得过于宽松；实际正式 service 仍含迁移失败后的旧键读写分支。RC11-1 已删除该正式回退，仅保留 migration-only 读取。其余未发现报告承诺但无入口的功能。
