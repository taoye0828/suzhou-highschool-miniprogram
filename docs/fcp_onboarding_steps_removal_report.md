# FCP 微信小程序新手教程第 6、7 步删除报告

## 任务与 Git 基线

- 任务名称：First-Check-Part（FCP）。
- 开始分支：`fix/v1-final-ux-miniprogram-20260804`。
- 开始 HEAD：`ec051a2bcaf104c1fe40cd54caf546d4881207b1`，与 `origin/fix/v1-final-ux-miniprogram-20260804` 一致。
- 开始状态：工作区与暂存区均干净，无 `.git/index.lock`；未从较旧的 `main` 开始修改。
- 实际工作分支：`fix/fcp-remove-onboarding-steps-6-7-20260804`。
- 修改前备份：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/FCP_20260804_214304`。

## 删除与收口

- 原正式完整教程为 7 步；从 `ONBOARDING_STEPS` 删除“建立目标规划”和“记录成绩变化”后，正式完整教程为 5 步，原前 5 步顺序不变。
- 删除第 6 步专用 selector `.onboarding-target-planning` 及首页、目标规划页的专用定位 class；目标规划按功能教程继续保留前两个仍有效步骤。
- 删除第 7 步专用 selector `.onboarding-trend-entry` 及成绩页的专用定位 class。
- 将正式运行配置中的同名旧流程短语“记录成绩变化”收口为“保存考试记录”，避免已删除步骤语义残留；成绩记录与趋势功能不变。
- 保留按功能重播使用的 `.onboarding-score-form` 和 `.onboarding-score-trend`，以及公共 onboarding overlay、selector 测量、失败降级、上一步、下一步、跳过、完成和持久化能力。
- 第 5 步“查看学校信息”成为最终步骤；组件继续使用唯一“开始使用”按钮并发送 `complete`，不再增加到索引 5。
- 对升级前停留在原索引 5/6 的活动教程状态，在现有运行逻辑中安全收口为完成并写回索引 4；不更改教程版本、Storage Schema 或数据迁移结构。
- 帮助页文案更新为“重播完整 5 步教程”，手动重播只返回 5 步。

## 测试结果

- `node scripts/verify_v1_final_ux.js`：PASS。
- `node scripts/verify_rc9_full.js`：PASS，14 个专项脚本通过。
- `node scripts/verify_v1_full.js --all-verify`：PASS，103 TEST-ID；87 个验证脚本全部通过。
- `node scripts/smoke_local_logic.js`：PASS。
- `node scripts/smoke_page_logic.js`：PASS。
- 全仓 JavaScript `node --check`：PASS。
- `git diff --check`：PASS。
- FCP 教程断言覆盖：正式 5 步与固定标题、删除标题和 selector 不存在、最终步骤 index 4/total 5、5→4→5、最终 next 直接完成、跳过、重播、完成持久化、原索引 5/6 安全收口、无业务数据写入、目标学校/成绩保存/成绩趋势正式入口保留。

## 功能、配置与数据保护

- 目标规划、添加目标学校、记录考试成绩和成绩趋势正式功能均保留；删除范围仅限两个教程步骤及其专用定位 class/selector。
- 未修改 `utils/rc9-storage.js`、`utils/storage-migration.js`、Storage Schema、Backup、Restore Point、用户档案或正式业务数据。
- `project.config.json` 未修改；名称仍为“苏程记录”，AppID 仍为 `wxc2a2a94f767438dd`。
- 正式数据仍为 55 所学校、146 条分数线（2025=103、2026=43），无超过 740 的记录，跨端一致性检查全部通过。
- 修改前后 SHA-256 保持一致：schools `c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2`；2025/合并 scores `0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88`；2026 scores `3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c`；product rules `bc1a7f0206c2df1124b954289f3ecf35af030a85582ba7a2d1e6da2b9ddd7085`。

## 平台验收与回滚

- `external_manual_acceptance`：pending。当前未执行微信开发者工具普通编译、Problems/Console、页面人工点击、预览、体验版上传或审核；脚本 PASS 不替代这些步骤。
- 提交前可从上述仓库外备份逐文件恢复；提交后可对 FCP 提交执行普通 `git revert <commit>`。不使用 reset、clean、rebase 或 force push。
