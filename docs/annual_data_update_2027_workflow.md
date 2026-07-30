# 2027 年度数据维护流程

本流程只用于开发维护。当前正式数据仍为 55 所学校、2025 年 103 条、2026 年 43 条，共 146 条；不得预测、估算或提前生成 2027 分数线。

## 目录与归档

- 原始官方页面：`docs/annual_data_2027_candidates/raw_pages/`
- 原始官方图片：`docs/annual_data_2027_candidates/raw_images/`
- 人工确认表：`docs/annual_data_2027_candidates/manual_confirmation.json`
- 候选记录：`docs/annual_data_2027_candidates/candidate_scores_2027.json`
- 年度报告：从 `docs/annual_data_2027_report_template.md` 复制后填写

整个 `docs` 目录已由 `project.config.json` 的上传包规则排除，不会进入小程序正式包。候选文件不得被 `app.js`、`pages/`、`utils/`、`data/` 或 `config/` 引用。

## 候选记录格式

每条候选记录必须包含：

`id`、`schoolId`、`year`、`region`、`batch`、`admissionType`、`scoreType`、`minScore`、`sourceTitle`、`sourceUrl`、`sourceCheckedAt`、`humanConfirmed`。

其中 `year` 只能为 2027，`minScore` 必须是 0—740 的整数，`schoolId` 必须匹配现有 55 所学校，`sourceUrl` 必须是 HTTPS 官方来源，`humanConfirmed` 在进入正式数据前必须为 `true`。学校主体与项目班必须通过 `batch + admissionType` 明确区分，不得把不同项目平均。

## 维护步骤

1. 保存官方原始页面和图片，不修改原始文件。
2. 在人工确认表记录来源标题、URL、获取日期、核对人和核对状态。
3. 使用 `node scripts/annual_data_2027_tool.js <候选文件>` 检查 schoolId、分数范围、日期、重复 ID、重复业务记录、来源链接与人工确认。
4. 两人逐条核对学校主体、校区、批次、招生类型和分数口径。
5. 未确认记录只保留在候选目录，不复制到 `data/`。
6. 全部确认后，由维护者明确批准生成双端正式数据；生成前再次保存三份正式数据哈希。
7. 小程序和 Flutter 同时生成，分别运行数量、ID、来源、740 上限、正式哈希与跨端一致性测试。
8. 更新 README 和年度报告，只写实际收录数量。
9. 提交信息使用 `data: add verified 2027 admission scores`；候选原始材料与正式代码分开提交。

## 自动阻断

以下任一情况必须阻断进入正式文件：

- `humanConfirmed` 不是 `true`；
- schoolId 不存在或发生主体/校区混淆；
- 分数不是 0—740 的整数；
- 来源不是 HTTPS 官方页面；
- 缺少核对日期；
- ID 或同一业务记录重复；
- 正式运行代码引用候选目录；
- 生成后 55 所学校数量改变；
- 生成后出现预测、估算或占位分数。

## 回滚

先使用仓库外备份恢复原数据文件，或对已提交的数据提交执行普通 `git revert <commit>`。禁止 reset、rebase、force push。回滚后重新执行数据哈希、数量、跨端一致性和完整测试。
