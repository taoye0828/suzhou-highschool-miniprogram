# 【RC11-1 RC10真实成果审计、用户路径验收与旧代码收口完整执行报告】（微信小程序）

## 一、开始状态与备份

- 路径/分支/远端：`/Users/tom/Dev/suzhou_highschool_miniprogram`，`main`，`https://github.com/taoye0828/suzhou-highschool-miniprogram.git`。
- 开始 HEAD：`4a4493c223a60516f85269b04479a4c98d3f8758`；本地 `origin/main`：`14edfd490ab3b2607d4a242dcf58ffc67a8be3c9`；merge-base 同 `origin/main`；ahead/behind `0 8`，无双向分叉。
- 工作区、staged、untracked 均为空；无 `.git/index.lock`；两次状态/HEAD 采样未变化。微信开发者工具常驻进程不是写入证据，未发现持续修改同仓库的并发任务。
- RC10 提交：`9e23581`、`96c990e`、`165198c`、`8349190`、`ae808b4`、`1dab62d`、`05f6ab3`、`4a4493c`。代码、报告、diff 与 RC10 18 项总门禁一致，确认 RC10 本地成果已完成但未推送。
- 完整仓库外备份：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC11_1_AUDIT_20260731_211043`；248 个文件，manifest 247 条，含 START_STATE、Git/路由/页面/组件/服务/存储/迁移/测试/文档清单、正式数据哈希和完整 tracked snapshot。
- 开始原始 SHA-256：schools `c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2`；2025/合并文件 `0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88`；2026 `3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c`。

## 二、RC10 审计与正式运行链路

- `docs/rc11_1_feature_inventory.json` 共 45 项：implemented 44、migration-only 1；partial/unreachable/duplicated/test-only/obsolete 均为 0；decision 为 keep 43、redirect 1、migrate-only 1。
- RC10 报告的事务写入、三成绩情景、失分原因、从复盘创建任务、学习目标进度、目标学校差距、质量矩阵、学校详情趋势、对比深化、最近浏览、跨端备份、数据检查/修复、动态帮助、2027 维护流程与图表摘要均有实际入口或明确内部工具链。多宽度完整人工交互仍属待验收，不写成完成。
- 报告与代码差异：正式 storage 仍有 migration 失败时的旧键回退读写，且报告没有明确这一运行时双轨风险。RC11-1 已删除正式回退，旧键只由 migration 读取；迁移失败保留原始数据但正式页面不展示/写入旧键。
- 五 Tab：`app.json` 固定为首页、学校库、成绩、目标规划、我的。正式入口、路由、Page、状态、Service、Storage adapter、键、Model、迁移、备份/导入、清除、刷新和测试详见 `docs/rc11_1_runtime_call_graph.md`。
- 首页：`home.js → planning/score-trend → storage → rc9-storage → profileData`；学校库/详情/收藏/对比共用同一 favorites/targets；成绩记录/趋势/复盘共用同一 scoreRecords；目标规划共用 scores/targets/stageGoals/tasks；我的集中档案、备份、数据管理、帮助与说明。

## 三、单一数据源、业务规则与旧代码

- 收藏、目标学校、成绩、复盘、失分原因、学习任务与学生档案均只写 `rc9.profile_data.v4[profileId]`；共享收藏只写 `rc9.shared_favorite_school_ids.v4`；activeProfile 只写 `rc9.active_profile_id.v4`。
- 旧键 7 个集中于 `utils/legacy/migration/storage-keys.js`，不再由正式 getter/setter 回退读写；页面直接调用微信 storage 为 0；清除会移除旧键并写 clearMarker，重启不会复活。
- 推荐/参考年份/目标分差唯一规则位于 `utils/planning.js`；总分上限位于 `config/app-config.js`；趋势排序由 `utils/score-trend.js` 复用 planning，不再复制第二套排序。0 点无点、1 点居中、2+ 点公式保持不变。
- 旧引用：A 类删除 0；B 类 `pages/target-analysis/*` 1 组，单跳到目标规划推荐分段且无数据读写；C 类 migration-only 1 组；D 类 8 个历史测试改为正式 v4 或 migration-only 契约。没有导航循环或旧页面正式写入。

## 四、三条用户路径与刷新

- first_use：固定档案 `profile-default`、考试 `exam-first-monthly`、650 分。Repository/正式容器均只有一条成绩；首页显示“第一次月考 / 650 分”；目标规划推荐读取 650；学校详情收藏与目标加入后学校库同步；主要目标、阶段目标在首页同步；重新加载 storage 后成绩、收藏、目标均无重复，transactionJournal 已清理。
- second_exam_review_task：期中考试 660 分，趋势顺序为第一次月考、期中考试；390 宽度点 x=`[38,352]`，考试名/日期标签均直接复用同一 `point.x`，误差 0。保存复盘、数学审题错误与“每周完成两次审题专项检查练习”；编辑为 665 后首页与目标规划刷新且只有一条期中考试；删除期中考试后 review/reason 按规则删除，独立 task 保留，显示“来源记录已删除，任务继续保留”。
- multi_profile_backup：默认档案 650/学校A/目标A，第二档案 610/学校B/目标B；往返切换完全隔离。导出含 2 档案及正确 profileId；损坏 JSON 和 checksum 错误导入均失败且 state 深比较不变；有效覆盖恢复后第二档案恢复，成绩/目标/阶段目标 ID 均无重复，事务临时键为空。
- 刷新：成绩新增/编辑/删除、收藏、加入目标、档案切换与清除的消费者、同步方式和 `onShow` 机制见 `docs/rc11_1_refresh_matrix.md`；未使用强制重启解决刷新。

## 五、缺陷修复

共 3 项：严重 0、中等 1、一般 2。

1. 中等：`utils/rc9-storage.js` 正式 service 在 schema 未激活时回退读写 7 个旧键，形成双轨和清除后复活风险。根因是 RC6-RC8 兼容分支未在 RC10 收口。修复为 migration-only key 目录、正式 getter/setter 仅 v4、迁移失败安全空态；更新 8 个历史测试。
2. 一般：`utils/score-trend.js` 重复实现排序并写死 740。根因是趋势模块早于统一 planning 规则。修复为复用 `planning.sortScoreRecords` 与 `EXAM_TOTAL_SCORE`；RC8 坐标全量回归不变。
3. 一般：删除考试后学习任务正确保留，但 `pages/targets/targets.wxml` 继续把来源类型显示为有效。根因是 presentation 未解析来源引用。新增 `presentLearningTask`，缺失 exam/review/reason 时安全降级。

## 六、小程序验证与数据边界

- RC11-1：13 个文件（12 子门禁 + full aggregator）全部通过；feature inventory 45 项；三用户路径通过；跨端 16/16 + Flutter runtime 6/6。
- 历史回归：实际存在的 62 个 `verify_*.js` 已先列出再逐个执行；首次暴露 `verify_rc7_1.js` 仍未初始化正式 v4，修复后从 RC7-1 到 RC10/RC11 全部重跑通过。两项 smoke 通过。
- JSON：`app.json`、`project.config.json`、feature inventory 可解析。JS：app/data 与全仓非 docs/node_modules JS `node --check` 全通过。`git diff --check` 通过。
- 正式数据：55 / 103 / 43 / 146，无重复 schoolId/scoreId、无无效引用、无 >740；规范化双端 hash 一致。三份原始 SHA-256 与开始值相同。
- 名称 `苏程记录`、AppID `wx17e903f81714736f` 未改变；上一名称和更早名称精确命中 0。未新增登录、后台、云开发、AI、网络推荐、上传、支付、广告、定位、推送、统计 SDK 或正式 2027 分数线。
- 微信开发者工具 RC11-1 人工视觉：未执行。RC10 曾完成普通编译/Problems 0/五 Tab 只读检查，但不能替代本轮 320/375/390/414/430/iPad、完整交互、预览、体验版上传或审核。

## 七、文档、Git 与回滚

- 文档：README、RC10 post audit、runtime graph、45 项 inventory、storage map、business rules、legacy map、refresh matrix、本报告均已更新。
- 提交将按 refactor/test/docs 分组，明确路径暂存；禁止 reset/clean/rebase/stash/force push/`git add .`。最终 SHA、push、ahead/behind、工作区、untracked 与 index.lock 在本轮最终统一报告中记录。
- 回滚：优先对 RC11-1 提交执行普通 `git revert <sha>`；或从上述外部备份逐文件恢复，再重跑 62 个 verify、两项 smoke、全仓 JS 语法、JSON、哈希和双端一致性。

## 结论

小程序代码级、调用链、存储、规则、旧兼容、三用户路径与全量自动回归通过；人工微信 DevTools 全交互、手机预览、体验版上传及审核仍待人工授权/验收。下一轮不应继续扩功能，优先完成这些平台人工步骤。
