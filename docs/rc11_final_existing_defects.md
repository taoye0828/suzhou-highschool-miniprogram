# RC11-FINAL-MP D001—D044 源码复核

审计基线：`217c55af2c55e061f7e28fa064c9d738596cc204`。状态值使用规定枚举。开始审计确认 44 项均可在正式源码路径复现；修复提交后逐项更新为 `fixed_verified`。

| ID | 状态 | 严重级别 | 文件 / 函数 | 触发路径与后果 | 修复方法 | TEST-ID | commit | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D001 | fixed_verified | critical | `utils/rc9-storage.js atomicWrite` | 正式值已写，committed journal 写失败却返回失败，页面误导重试 | 按最终回读分类 committed_with_warning/uncertain | V1-TXN-008 | P1 checkpoint | 已提交数据返回 committed_with_warning |
| D002 | fixed_verified | critical | `utils/rc9-storage.js atomicWrite` | journal 删除失败返回 ok:false，数据已提交却误报 | 清理失败返回 committed_with_warning | V1-TXN-010 | P1 checkpoint | 清理失败不再误报业务失败 |
| D003 | fixed_verified | critical | `restoreFromRestorePoint` | 恢复提交后验证/清理失败仍显示原数据保留 | 用 committed 字段和最终回读生成提示 | V1-RECOVERY-003 | P1 checkpoint | 提交后清理失败返回 committed_with_warning |
| D004 | fixed_verified | critical | `atomicRemove` | 删除成功但 removing journal 残留，启动恢复 before | 写 expectedAfter 和 committed journal；启动只清理 | V1-TXN-011 | P1 checkpoint | 连续两次恢复不复活 |
| D005 | fixed_verified | critical | `recoverInterruptedTransaction` | removing 未记录已提交语义，无法区分未完成清除 | 分类 committed remove 与 uncommitted remove | V1-TXN-011 | P1 checkpoint | expectedAfter 区分已提交清除 |
| D006 | fixed_verified | high | `pages/**`、`protectedCall` | 除恢复点页外写操作未提供稳定 operationId | 页面 OperationContext 覆盖正式写入口 | V1-LOCK-006 | P1 checkpoint | 主要正式页面显式传入，service 兜底生成 |
| D007 | fixed_verified | critical | `protectedCall` | operationId 为空直接 action，幂等和锁被旁路 | service 强制生成/校验上下文，不允许旁路 | V1-LOCK-007 | P1 checkpoint | 生产旁路已删除 |
| D008 | fixed_verified | high | `finishOperation` | operation state 保存完整 result，可含数组/payload | 只存紧凑摘要，100 条/2048 字节 | V1-LOCK-008 | P1 checkpoint | 105 次操作后数量和单条字节门禁通过 |
| D009 | fixed_verified | high | `importBackupEnvelope` | 同 checksum 导入原先复用固定 safety operationId | 每次导入使用独立 operationId 和新恢复点 | V1-BACKUP-009 | P2 | 同一备份连续导入产生两个不同恢复点 |
| D010 | fixed_verified | high | `deleteRestorePoint`、operation state | 恢复点删除后旧幂等结果仍可报成功 | 幂等返回前校验恢复点仍存在 | V1-RECOVERY-010 | P1 checkpoint | 删除后同 operationId 可安全重建 |
| D011 | fixed_verified | high | `app.js`、`pages/data-management` | 启动异常只记录状态，没有完整用户处理入口 | 未完成数据操作卡片和安全操作 | V1-RECOVERY-011 | P1 checkpoint | 数据管理提供重试、保留正式、使用临时入口 |
| D012 | fixed_verified | critical | `deleteStudentProfile` | 删除档案前无 full_user_state 恢复点 | 删除前创建唯一恢复点 | V1-RECOVERY-012 | P1 checkpoint | full_user_state 恢复点验证通过 |
| D013 | fixed_verified | critical | `clearScoreRecords` | 清空成绩前无恢复点 | 当前档案恢复点 + protected clear | V1-RECOVERY-013 | P1 checkpoint | 恢复点与清空结果通过 |
| D014 | fixed_verified | critical | `clearTargetRecords` | 清空目标学校前无恢复点 | 当前档案恢复点 + protected clear | V1-RECOVERY-014 | P1 checkpoint | 恢复点与清空结果通过 |
| D015 | fixed_verified | critical | stage/task clear | 清空阶段目标或任务前无恢复点 | 每次新恢复点 | V1-RECOVERY-015 | P1 checkpoint | 两类清空均有独立恢复点 |
| D016 | fixed_verified | critical | `payloadForScope/stateAfterRestore` | shared 档案 single_profile 默认携带并恢复共享收藏 | 默认排除共享收藏，显式 opt-in | V1-RECOVERY-016 | P1 checkpoint | 共享收藏保持当前值 |
| D017 | fixed_verified | high | `stateAfterRestore` | 档案已删除时抛 PROFILE_NOT_FOUND | 支持恢复为新档案 | V1-RECOVERY-012 | P1 checkpoint | 已删除档案及成绩恢复通过 |
| D018 | fixed_verified | high | `validateRestorePoint` | 原实现未校验 storageSchemaVersion | v1 适配读取、v2 版本门禁 | V1-RECOVERY-018 | P2 | 高版本拒绝，Schema v4 恢复点兼容 |
| D019 | fixed_verified | high | `validateRestorePoint` | 原实现未校验 backupFormatVersion | 兼容列表和高版本拒绝 | V1-RECOVERY-019 | P2 | Backup v2/v3 门禁通过 |
| D020 | fixed_verified | high | `validateRestorePoint` | 原实现未校验 appDataVersion | 兼容列表和高版本拒绝 | V1-RECOVERY-020 | P2 | rc11-2/v1 兼容和未来版本拒绝通过 |
| D021 | fixed_verified | critical | `validateRestoreState` | 原引用校验只覆盖旧实体 | 扩展考试、复盘、错题、任务、周计划、阶段复盘、学校状态和方案引用 | V1-DATA-021 | P2 | 无效周计划任务引用被拒绝 |
| D022 | fixed_verified | critical | `restoreRepairSnapshot` | repairSnapshot 恢复绕过 before_restore | 接入恢复点与 protected transaction | V1-RECOVERY-022 | P3 checkpoint | 恢复前创建 before_restore |
| D023 | fixed_verified | critical | `pages/score-trend` save flows | 成绩和复盘分次写，可能半成功 | service 单事务保存聚合 | V1-TXN-023 | P3 checkpoint | 成绩与复盘同一受保护事务提交 |
| D024 | fixed_verified | high | `saveTargetRecord` | 修改等级用新对象替换，缺省 reference 字段被清空 | patch 合并保留未提供字段 | V1-DATA-024 | P3 checkpoint | referenceScore/referenceYear 保留 |
| D025 | fixed_verified | high | `selectPrimaryTarget` 调用链 | 无主要目标时自动挑选其他学校 | 主要目标为空即为空 | V1-DATA-025 | P3 checkpoint | 无显式主要目标返回 null |
| D026 | fixed_verified | high | `deleteLearningTargetRecord` | 删除目标后任务保留失效 stageGoalId | 同事务清空任务引用 | V1-LEARNING-026 | P3 checkpoint | 关联任务 stageGoalId 同步清空 |
| D027 | fixed_verified | high | score review delete flow | 删除复盘可能按 examRecordId 清全部失分原因 | 增加 reviewId，只删明确关联 | V1-LEARNING-027 | P3 checkpoint | 同考试其他复盘的失分原因保留 |
| D028 | fixed_verified | high | `pages/score-trend` task draft | 构造并不存在的 sourceReviewId | 只引用真实已保存实体 | V1-LEARNING-028 | P3 checkpoint | 仅从 reason.reviewId 带入真实引用 |
| D029 | fixed_verified | medium | `saveLearningTask` | 判重未优先 sourceLossReasonId | 业务唯一键优先 loss reason/mistake | V1-LEARNING-029 | P3 checkpoint | 失分原因与错题 ID 优先判重 |
| D030 | fixed_verified | high | recommendation settings/pages | 用户可自定义正式历史分差边界 | 运行代码固定规则源边界 | V1-SCHOOL-030 | P3 checkpoint | 自定义入口和死代码已移除 |
| D031 | fixed_verified | high | `normalizeRecommendationSettings` | 自定义上下界允许空档 | 删除普通用户边界编辑，固定连续区间 | V1-SCHOOL-031 | P3 checkpoint | -30/-1/0/15/16 连续边界通过 |
| D032 | fixed_verified | high | `scenarioResults`/历史分差 | 情景规划和正式规则可使用不同边界 | 共用唯一分类函数，分数源分离 | V1-SCHOOL-032 | P3 checkpoint | 情景结果与正式分类逐项一致 |
| D033 | fixed_verified | medium | targets reference score UI | 手动参考成绩无清晰取消 | “恢复使用正式参考成绩”操作 | V1-SCHOOL-033 | P3 checkpoint | 用户可一次恢复正式成绩源 |
| D034 | fixed_verified | high | 页面日期函数/`toISOString` | UTC 截取导致本地自然日偏移 | `utils/local-date.js` | V1-DATA-034 | P3 checkpoint | 本地自然日与周一至周日通过 |
| D035 | fixed_verified | medium | school/target year UI | 2025、2026 写死，数据更新后漂移 | 从正式分数数据动态生成 | V1-SCHOOL-035 | P3 checkpoint | 年份选项由正式数据生成 |
| D036 | fixed_verified | medium | `config/app-config.js` | releaseStatus 仍是旧阶段 | 写内部最终冻结状态 | V1-FREEZE-036 | P3 checkpoint | 内部状态为 V1 功能冻结版 |
| D037 | fixed_verified | medium | dynamic help 调用 | hasBackup 固定 false | 读取真实备份/导出状态 | V1-DATA-037 | P3 checkpoint | 帮助卡片使用 hasExportedBackup 真实状态 |
| D038 | fixed_verified | high | `pages/favorites` | 打开收藏页就写回删除无效 ID | 只展示告警，不在读取路径写入 | V1-SCHOOL-038 | P3 checkpoint | refresh 仅读，用户主动点击才清理 |
| D039 | fixed_verified | high | `utils/subject-analysis`/趋势页 | 学科趋势只看当前 config maxScore | 优先历史 subject score/scheme snapshot | V1-TREND-039 | P3 checkpoint | 历史 maxScore 优先并通过回归 |
| D040 | fixed_verified | medium | `normalizeSubjectConfig` | 配置缺完整 version/createdAt/updatedAt | 归一化并在保存时递增版本 | V1-EXAM-040 | P3 checkpoint | version 递增且 createdAt 保持 |
| D041 | fixed_verified | critical | `mergeProfileData` | 对象展开会让备份设置直接覆盖本机设置 | 实体逐项合并，设置默认保留本机并支持显式 backup 选择 | V1-BACKUP-041 | P2 | 本机推荐/情景/筛选/年份保持 |
| D042 | fixed_verified | high | `exportBackupFile`/UI | 文件只在沙盒生成，没有主动带走链路 | FileShareAdapter + 摘要/隐私确认 | V1-BACKUP-042 | P3 checkpoint | 主动发送、取消、失败和重试语义已接入 |
| D043 | fixed_verified | high | `utils/checksum.js` | 备份 FNV-1a、恢复点 SHA-256 两套 | 新写统一 SHA-256，v2 FNV 只读适配 | V1-BACKUP-043 | P2 | canonical 边界和 v2/v3 摘要通过 |
| D044 | fixed_verified | high | `scripts/verify_rc11_2_*`、`scripts/v1/release-freeze-suite.js` | 历史 PASS 未覆盖生产页面旁路和提交后失败 | V1 分套件覆盖真实 service/page 契约，并由最终冻结套件扫描正式 Service 与页面写入口 | V1-FREEZE-044 | 1bd7459d29db3a6e03994513371e90ff78a39a18 | 生产旁路、operationId、事务提交后失败和正式页面写入口均有最终冻结回归 |

## 开始验证证据

- RC11-2 全套：通过（14 个子门禁）。
- RC11-1 全套：通过（12 个子门禁）。
- RC9 全套：通过（14 个专项）。
- RC10 全套：通过（18 个专项）。
- smoke_local_logic / smoke_page_logic / 上传包排除：通过。
- 上述结果仅说明既有行为未回归；D001—D044 按本轮最终契约仍为 confirmed。
