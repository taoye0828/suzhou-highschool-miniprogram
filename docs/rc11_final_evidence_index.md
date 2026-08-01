# RC11-FINAL-MP 证据索引

| 证据 | 文件 | 结论 |
| --- | --- | --- |
| 执行计划 | `docs/rc11_final_execution_plan.md` | P0—P8、回滚、性能和阻断边界 |
| 缺陷复核 | `docs/rc11_final_existing_defects.md` | D001—D044 全部 fixed_verified |
| 进度 | `docs/rc11_final_progress.json` | 最后稳定提交、测试和推送状态 |
| 数据模型 | `docs/v1_data_model_spec.md` | Schema v5 及实体限制 |
| 事务 | `docs/v1_storage_transaction_spec.md` | committed / aborted / uncertain |
| 迁移 | `docs/v1_migration_report.md` | v4 → v5 幂等迁移 |
| 备份恢复 | `docs/v1_backup_restore_spec.md` | Backup v3 / Restore Point v2 及旧版兼容 |
| 考试系统 | `docs/v1_exam_template_spec.md`, `docs/v1_score_scheme_spec.md`, `docs/v1_score_rate_spec.md` | 模板、方案、快照、得分率 |
| 历史分差资格 | `docs/v1_recommendation_eligibility.md` | 仅合格 740 完整总分记录 |
| 学习闭环 | `docs/v1_learning_loop_spec.md` | 错题、任务、周计划、阶段目标和复盘 |
| 学校状态 | `docs/v1_school_user_state_spec.md` | 状态、标签、备注、筛选和对比 |
| 报告 | `docs/v1_report_export_spec.md` | 当前档案 text / JSON 与主动分享 |
| 测试覆盖 | `docs/v1_test_coverage_matrix.json` | 103 个 V1 TEST-ID，D001—D044 映射 |
| 生命周期 | `docs/v1_entity_lifecycle_matrix.json` | 17 类实体 16 项生命周期字段无缺项 |
| 冻结清单 | `docs/v1_feature_freeze_manifest.json` | included / excluded / developer_only / platform_specific，无 partial |
| 冻结报告 | `docs/v1_feature_freeze_report.md` | `V1_CODE_FREEZE_READY`，体验人工验收待完成 |
| 首发验收 | `docs/v1_first_release_acceptance.md` | 自动门禁与人工检查分离 |
| 完整报告 | `docs/rc11_final_full_report.md` | RC11-FINAL-MP 最终执行结论 |
| 机器证据 | `docs/rc11_final_evidence.json` | 身份、版本、测试、数据、Git 和平台状态 |

仓库外恢复资料位于 `/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC11_FINAL_MP_20260801_162207`。自动测试结果不能替代微信开发者工具、真机、分享、恢复和多尺寸人工验收。
