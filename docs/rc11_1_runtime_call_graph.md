# RC11-1 小程序正式运行调用链

## 字段口径

- 用户入口：用户可见操作；路由：`app.json` 注册路径；页面：真实 Page 文件；页面状态：Page `data` 与 `onShow/loadAll/loadRecords/refresh`。
- Controller/ViewModel：小程序未另设 Controller/ViewModel，Page 负责交互编排；Service：真实纯逻辑或本地用户数据服务；Repository：本项目未单设 Repository，正式静态数据直接由 `data/*.js` 加载，用户数据统一进入 Storage adapter。
- Storage adapter：`utils/storage.js → utils/rc9-storage.js`；存储键：正式 v4 容器或共享键；Model：`utils/rc9-models.js`；迁移函数：`utils/storage-migration.js`。
- 导出字段/导入字段：`utils/backup-restore.js` 的 RC10 v2 顶层字段；清除逻辑：当前档案或全部清除；刷新机制：写入增加 `rc9.data_revision.v4`，正式页面在 `onShow` 重新读取；测试：真实脚本路径。

| 功能 | 用户入口 | 路由 | 页面 / 页面状态 | Controller/ViewModel | Service / Repository | Storage adapter / 存储键 / Model / 迁移函数 | 导出字段 / 导入字段 / 清除逻辑 | 刷新机制 | 测试 |
|---|---|---|---|---|---|---|---|---|---|
| 首页摘要 | 首页 | `pages/home/home` | `pages/home/home.js` / `refreshOverview` | Page | `planning`, `score-trend` / 无 | adapter / `rc9.profile_data.v4` / RC9-RC10 models / v1→v4 | scores, targets, stageGoals / 同字段 / profile或all | `home.onShow` | `verify_rc11_1_user_journey_first_use.js` |
| 学校搜索 | 学校库搜索框 | `pages/schools/schools` | `pages/schools/schools.js` / keyword | Page | `school-search`, `school` / 无 | 无用户写入 | 无 / 无 / 无 | 输入后 `refresh` | `verify_rc9_school_filters.js` |
| 学校筛选 | 学校库筛选 | 同上 | 同上 / filter state | Page | `school` / 无 | adapter / profileData.schoolFilters / model / v3→v4 | schoolFilters / schoolFilters / profile或all | 变更即保存并 refresh | `verify_rc9_school_filters.js` |
| 学校详情 | 学校卡片 | `pages/school-detail/school-detail` | `school-detail.js` / `refresh` | Page | `school`, `planning` / 无 | adapter / profileData / model / v1→v4 | recentHistory / recentHistory / profile或all | `onShow` | `smoke_page_logic.js` |
| 收藏 | 学校卡片或详情 | schools, school-detail, favorites | 三个正式页面 / favorite state | Page | `storage` / 无 | adapter / profileData 或 sharedFavorites / model / legacy→v4 | favorites / favorites / profile或all | 各页 `onShow` | `verify_rc11_1_user_journey_first_use.js` |
| 对比 | 学校库对比 | `pages/school-compare/school-compare` | `school-compare.js` / selectedIds | Page | `planning`, `school` / 无 | adapter / profileData.comparisonSchoolIds / model / v3→v4 | comparisonSchoolIds / 同字段 / profile或all | `onShow` | `verify_rc10_school_compare.js` |
| 成绩新增 | 成绩→记录 | `pages/score-trend/score-trend` | `score-trend.js` / record form | Page | `storage` / 无 | adapter / profileData.scoreRecords / ExamRecord / legacy→v4 | scoreRecords / scoreRecords / score/profile/all | `loadRecords` + 相关页 `onShow` | `verify_rc11_1_user_journey_first_use.js` |
| 成绩编辑 | 成绩→记录→编辑 | 同上 | 同上 / editingRecordId | Page | `storage` / 无 | 同上 | 同上 | `loadRecords` + 相关页 `onShow` | `verify_rc11_1_user_journey_second_exam.js` |
| 成绩删除 | 成绩→记录→删除 | 同上 | 同上 / modal | Page | `storage` / 无 | 同上 | 删除 score/review/reason，独立 task 保留 | `loadRecords` + 相关页 `onShow` | `verify_rc11_1_user_journey_second_exam.js` |
| 成绩趋势 | 成绩→趋势 | 同上 | 同上 / visibleTrendPoints | Page | `score-trend → planning.sortScoreRecords` / 无 | adapter / profileData.scoreRecords / ExamRecord / v1→v4 | scoreRecords / scoreRecords / score/all | `loadRecords` 后重绘 | `verify_rc8_chart_vertical_alignment.js` |
| 学科成绩 | 成绩→记录/趋势 | 同上 | 同上 / subject state | Page | `subject-analysis` / 无 | adapter / profileData.subjectConfigs+scoreRecords / SubjectConfig / v3→v4 | subjectConfigs, scoreRecords / 同字段 / profile/all | `loadRecords` | `verify_rc9_subject_scores.js` |
| 考试复盘 | 成绩→复盘 | 同上 | 同上 / reviewDraft | Page | `storage` / 无 | adapter / profileData.scoreReviews / ScoreReview / 无 | scoreReviews / scoreReviews / score/profile/all | `loadRecords` | `verify_rc11_1_user_journey_second_exam.js` |
| 失分原因 | 成绩→复盘→失分原因 | 同上 | 同上 / savedLossReasons | Page | `storage`, `rc10-features` / 无 | adapter / profileData.scoreLossReasons / ScoreLossReason / 无 | scoreLossReasons / 同字段 / score/profile/all | `loadRecords` | `verify_rc11_1_user_journey_second_exam.js` |
| 学习任务 | 复盘创建；目标规划查看 | score-trend, targets | 两页 / learningTasks | Page | `storage` / 无 | adapter / profileData.learningTasks / LearningTask / 无 | learningTasks / learningTasks / profile/all | `targets.onShow`; 失效来源安全降级 | `verify_rc11_1_user_journey_second_exam.js` |
| 推荐 | 目标规划→推荐 | `pages/targets/targets` | `targets.js` / recommendation state | Page | `score-analysis`, `planning` / 无 | adapter / profileData settings+scores / models / v3→v4 | settings, scores / 同字段 / profile/all | `loadAll` | `verify_rc9_target_center.js` |
| 目标学校 | 推荐或详情加入 | targets, school-detail | 两页 / target records | Page | `storage` / 无 | adapter / profileData.targetRecords / TargetRecord / legacy→v4 | targetSchools / targetSchools / target/profile/all | 相关页 `onShow` | `verify_rc11_1_user_journey_first_use.js` |
| 主要目标 | 目标规划设定 | `pages/targets/targets` | targets / primary id | Page | `storage`, `planning` / 无 | adapter / profileData.primaryTargetSchoolId / model / v3→v4 | primaryTargetSchoolId / 同字段 / target/profile/all | home+targets `onShow` | `verify_rc11_1_user_journey_first_use.js` |
| 目标分差 | 首页或目标规划 | home, targets | 两页 / difference text | Page | `planning.selectGap` / 无 | 读 profileData score+targets | scores+targets / 同字段 / 对应清除 | `onShow` | `verify_rc10_target_gap_trend.js` |
| 阶段目标 | 目标规划→学习目标 | `pages/targets/targets` | targets / learningDraft | Page | `storage` / 无 | adapter / profileData.stageGoals / StageGoal / legacy→v4 | stageGoals / stageGoals / stage/profile/all | targets+home `onShow` | `verify_rc9_stage_goals.js` |
| 多档案 | 我的→档案管理 | `pages/profile-management/profile-management` | profile-management / activeProfile | Page | `storage` / 无 | adapter / profiles+activeProfileId+profileData / Profile / v3→v4 | profiles+profileData / 同字段 / profile/all | 五 Tab `onShow` | `verify_rc11_1_user_journey_multi_profile.js` |
| 备份导出 | 我的→备份与恢复 | `pages/backup-restore/backup-restore` | backup-restore / exportPreview | Page | `backup-restore` / 无 | adapter / 正式用户键 / backup model / v1兼容 | 全部用户字段 / 无写入 / 无 | 页面 refresh | `verify_rc11_1_user_journey_multi_profile.js` |
| 备份导入 | 同上 | 同上 | 同上 / importPreview | Page | `backup-restore` / 无 | adapter / importSnapshot+正式用户键 / backup model / v1兼容 | 全部用户字段 / 全部用户字段 / all | 成功后各页 `onShow` | 同上 |
| 数据检查 | 我的→数据管理 | `pages/data-management/data-management` | data-management / healthReport | Page | `data-health` / 无 | adapter / 全部正式用户键 / models / migration residues | 无 / 无 / 无 | `onShow` | `verify_rc10_data_health.js` |
| 数据修复 | 数据检查→安全修复 | 同上 | 同上 / repairResult | Page | `data-health` / 无 | adapter / repairSnapshot+profileData / models / 无 | 无 / 无 / snapshot restore | 修复后五 Tab `onShow` | `verify_rc10_data_health.js` |
| 动态帮助 | 我的顶部 | `pages/profile/profile` | profile / dynamicHelp | Page | `onboarding`, `rc10-features` / 无 | adapter / onboardingV4+profileData / models / legacy→v4 | tutorial / tutorial / all | `profile.onShow` | `verify_rc10_dynamic_help.js` |
| 清除数据 | 我的→数据管理 | `pages/data-management/data-management` | data-management / modal | Page | `storage` / 无 | adapter / all known keys+clearMarker / models / ignoreLegacy | 无 / 无 / current或all | 五 Tab `onShow` | `verify_rc9_clear_data.js` |
| 最近浏览 | 我的→最近浏览 | `pages/profile/profile` | profile / recentSchools | Page | `storage` / 无 | adapter / profileData.recentHistory / model / v3→v4 | recentHistory / recentHistory / profile/all | `profile.onShow` | `verify_rc10_recent_history.js` |

旧 `pages/target-analysis/target-analysis` 不是正式功能链：它只设置推荐分段并单跳 `switchTab` 到目标规划，不读写用户数据。
