# FCP 微信小程序全仓深度代码审计问题清单

- 审计日期：2026-08-08
- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 审计分支：`fix/fcp-mp-deep-code-audit-fix-20260808`
- 起始 HEAD：`0900e8eb89294e8dc1b2eff762a07bafdbd871e4`
- tracked 文件：303
- 审计原则：先完成全仓审计和问题归档，再制定计划，最后修复；本文件建立前未修改业务代码。
- 修复前统计：P0 = 0，P1 = 5，P2 = 2，P3 = 3。
- 第二遍复审：303/303 tracked 文件仍全部在台账中；修复后已知 P0 = 0、P1 = 0，FCP-006/FCP-011 已修复，FCP-007 = ACCEPTED_P2，FCP-008—010 = DEFERRED_P3。

## 审计证据摘要

- 全部 303 个 tracked 文件已进入逐文件台账；142 个 JavaScript 已逐文件执行 `node --check`。
- 27 个 JSON 全部解析成功；10 个页面的 JS/JSON/WXML/WXSS 全部检查。
- require 图：142 个 JS，正式运行链无缺失模块、无循环依赖；历史开发脚本发现 46 处已移除模块引用。
- 正式数据：55 所学校；2025 年 103 条；2026 年 43 条；合计 146；超过 740 为 0；学校 ID、分数 ID 均无重复，分数 schoolId 均存在。
- 隐私接口：正式运行代码仅发现用户主动触发的 `wx.setClipboardData`、`wx.chooseMessageFile` 和备份文件读写/发送；未发现剪贴板读取、登录、定位、支付、广告、云、统计 SDK 或网络请求。
- 配置：AppID 正确；`ignoreDevUnusedFiles=false`（tracked/private 双份）；`uploadWithSourceMap=false`；Sitemap 无 `allow *`。
- 修复前主要 release gates、smoke、全量语法和 `git diff --check` 均 PASS，但现有门禁没有覆盖合并后上限和新记录字段形状。

## 问题详情

### FCP-001（P1）合并恢复可突破硬上限

- 文件/位置：`utils/backup-restore.js`，`mergeProfileData`、`importBackupEnvelope`。
- 触发条件：本机与备份各自都合法，但档案 ID 或记录 ID 的并集超过上限。
- 影响：可得到 12 个档案或同档案 120 条成绩/目标；后续导出会生成自身无法再导入的备份，产品上限失效。
- 可复现：是。审计实测本机 7 档案 + 备份 6 档案（1 个重合）后成功写入 12 档案；共享档案 60 + 60 条成绩后成功写入 120 条。
- 修复建议：在任何正式写入和安全恢复点创建前，对最终 nextState 做完整上限预检；超限明确拒绝且本机数据不变。
- 关联文件：`scripts/verify_dual_final_hardening.js`。
- 回归：合法边界合并通过；11 档案、101 成绩、101 目标的“合并结果”拒绝。
- 状态：**FIXED**。最终 nextState 在创建恢复点和正式写入前统一校验；三类合并超限均返回 `LIMIT_EXCEEDED`，失败前后业务状态和恢复点不变。

### FCP-002（P1）新核心记录仍生成已删除业务字段

- 文件/位置：`utils/rc9-models.js` 的 `normalizeExamRecord`、`normalizeTargetRecord`；`pages/school-detail/school-detail.js` 的 `addTarget`。
- 触发条件：首发 UI 新建仅含名称/日期/总分的成绩，或新增普通目标学校。
- 影响：新成绩被自动扩展出 subjectScores、rank、examTemplate、scoreScheme、scoreRate 等旧字段；新目标写入 level。虽然 UI 隐藏，但新业务数据仍持续生成已删除模型。
- 可复现：是，直接检查 normalized 新记录即可复现。
- 修复建议：旧字段“有则保留、无则不生成”；新 UI 只写核心字段；不得影响旧备份读取、覆盖恢复和旧记录编辑。
- 关联文件：`scripts/verify_fcp_mp_first_release.js`。
- 回归：原始 storage 中新成绩/新目标不含旧高级字段；带旧字段的历史记录仍完整往返。
- 状态：**FIXED**。normalizer 改为输入存在才保留旧字段；新成绩无单科/排名/模板/分值方案/得分率等字段，新目标无 `level`，旧备份往返门禁通过。

### FCP-003（P1）隐私页未明确说明实际隐私接口

- 文件/位置：`pages/privacy/privacy.js`、`pages/privacy/privacy.wxml`。
- 触发条件：用户或审核人员对照代码与小程序内隐私说明。
- 影响：代码实际使用 Clipboard 与 MessageFile，但页面没有说明其用户主动触发用途，和微信后台已声明能力不够一致。
- 可复现：是。
- 修复建议：增加“剪贴板”和“选中的文件”说明，限定为主动复制客服/学校公开信息与主动选择苏程记录备份文件；明确不读取剪贴板、不后台扫描/上传文件。
- 关联文件：`scripts/verify_fcp_mp_first_release.js`。
- 回归：代码 API 扫描与隐私文案逐项对应，且不得移除正式复制/恢复能力。
- 状态：**FIXED**。已明确 Clipboard、MessageFile 和用户主动发送备份的用途，并明确不后台读取剪贴板、扫描或上传无关文件。

### FCP-004（P1）非法学校路由留下空白页

- 文件/位置：`pages/school-detail/school-detail.js` 的 `onLoad`；对应 WXML 根节点。
- 触发条件：schoolId 缺失、无效、被移除或深链参数错误。
- 影响：只显示一次 Toast，页面主体因 `wx:if="{{school}}"` 完全不渲染，形成审核与用户可见的空白页。
- 可复现：是。
- 修复建议：增加明确 notFound 空状态和安全返回按钮；合法 schoolId 路径不变。
- 关联文件：`pages/school-detail/school-detail.wxml`、FCP handler gate。
- 回归：合法详情正常；非法 ID 有稳定文案和可用返回操作，不出现白屏。
- 状态：**FIXED**。缺失、无效和无法 decode 的 ID 都进入 `notFound` 空状态；有页面栈时返回上页，无页面栈时回到学校库 Tab。

### FCP-005（P1）通用人工验收清单仍指向旧产品

- 文件：`docs/manual_wechat_release_checks.md`。
- 触发条件：后续按文件名将其作为当前人工发布清单执行。
- 影响：包含旧 AppID `wx17...`、收藏/学习目标 Tab、成绩分析、学校对比、WebView、12 条趋势等已删除功能，会导致验收错误或诱导恢复旧功能。
- 可复现：是。
- 修复建议：改为当前 FCP 的 10 页/五 Tab/正式 AppID/Clipboard/MessageFile/真机和上传审核边界清单。
- 回归：全文扫描不得出现旧 AppID 与已删除正式功能指令。
- 状态：**FIXED**。通用清单已改为当前 AppID、10 页/五 Tab、状态矩阵、Clipboard/MessageFile，并严格分开模拟器、真机、体验版和审核证据。

### FCP-006（P2）档案改名长度与创建入口不一致

- 文件：`pages/profile-management/profile-management.js`。
- 触发条件：editable modal 输入超过 20 个字符。
- 影响：创建入口限制 20，但改名可写到模型兼容上限 40，可能造成长文本布局压力。
- 修复建议：改名提交时校验 1–20 字符；不修改底层 40 字符旧数据兼容上限。
- 回归：20 允许，21 拒绝，旧长昵称仍可读取不被静默截断。
- 状态：**FIXED**。只在 editable modal 提交时新增 20 字符校验，未改动底层 40 字符旧数据兼容上限。

### FCP-007（P2）历史开发测试不再符合当前产品

- 范围：历史 RC6–RC11/V1 分段脚本与 suite。
- 证据：require 图发现 46 处对已移除 utils 的引用；部分脚本仍断言教程、推荐、收藏、对比、学习、报告等旧 UI。
- 影响：这些脚本不在当前 release gate 且被上传包排除，但单独运行会失败或产生错误产品期待。
- 建议：本轮不以恢复旧功能让旧测试通过；明确标为历史 DEV_ONLY，并由当前 FCP gate/脚本清单定义唯一发布门禁。审核后可单独做测试资产归档重构。
- 状态：**ACCEPTED_P2**。旧脚本继续作为 DEV_ONLY 历史证据，不进入上传包，不通过恢复已删除功能使其通过。

### FCP-008（P3）运行兼容层仍包含较大旧业务表面

- 范围：`utils/rc9-storage.js`、`utils/rc9-models.js`、`utils/v1-domain.js`、`utils/planning.js`、`utils/runtime-constants.js`。
- 说明：大量旧 API/字段仅为 Schema 5 / Backup 3 / Restore Point 2 与旧备份兼容，无正式路由或 UI。
- 决策：DEFERRED_P3。审核前不做大规模架构重写；只修“新记录不再生成旧字段”。

### FCP-009（P3）默认中考年份为固定 2027

- 文件：`config/app-config.js`。
- 影响：2028 年后默认值需维护，但当前 2026 首发不阻断。
- 决策：DEFERRED_P3；避免审核前改变既有倒计时与数据默认值。

### FCP-010（P3）部分小按钮触控高度偏紧

- 文件：`styles/common.wxss` 及页面局部样式。
- 影响：部分 small-button 小于常见 44px 建议值；当前布局与模拟器尚未证明阻断。
- 决策：DEFERRED_P3，纳入人工小屏与真机可用性观察；不在审核前做全局视觉改造。

### FCP-011（P2）嵌套 `.DS_Store` 的上传排除证据不完整

- 文件：`project.config.json`、`scripts/verify_upload_package_ignore.js`。
- 发现阶段：第二遍复审的上传包估算。
- 影响：旧 `file: .DS_Store` 门禁只验证根目录精确路径，未证明 `pages/.DS_Store`、`utils/.DS_Store` 等嵌套文件不进包。
- 状态：**FIXED**。改为 `suffix: .DS_Store`，并对根目录及嵌套路径都增加上传排除断言；未删除任何文件。

## 全仓逐文件台账

| 文件 | 类型 | 是否正式运行 | 检查状态 | 问题等级 | 问题摘要 |
|---|---|---:|---|---|---|
| `.gitignore` | OTHER | 否 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `README.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `app.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `app.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `app.wxss` | WXSS | 是 | P3 | P3 | FCP-010 小按钮触控高度偏紧，当前未构成阻断 |
| `config/app-config.js` | JS | 是 | P3 | P3 | FCP-009 默认中考年份固定 2027，属未来年份维护项 |
| `data/admission-scores-2026.js` | DATA | 是 | DATA | — | 正式数据：结构、ID、引用、分值与数量已校验；禁止修改 |
| `data/admission-scores.js` | DATA | 是 | DATA | — | 正式数据：结构、ID、引用、分值与数量已校验；禁止修改 |
| `data/schools.js` | DATA | 是 | DATA | — | 正式数据：结构、ID、引用、分值与数量已校验；禁止修改 |
| `docs/annual_data_2027_candidates/candidate_scores_2027.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/annual_data_2027_candidates/manual_confirmation.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/annual_data_2027_report_template.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/annual_data_update_2027_workflow.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/audit_fix_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/cross_platform_consistency_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/fcp_mp_first_release_consolidation_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/final_rc4_completion_matrix.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/final_rc4_coverage_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/final_rc4_progress.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/final_rc6_upgrade_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/fixtures/rc11_2_restore_point_fixture.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/manual_wechat_release_checks.md` | DOC | 否 | FIXED | — | FCP-005 已改为当前 FCP 人工验收清单 |
| `docs/miniprogram_cross_platform_audit_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp10_appid_and_correct_project_guide.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp10_devtools_open_result.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp12_package_cleanup_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp12_public_ui_cleanup.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp13_2026_scores_sync_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp13_2026_scores_to_confirm.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp16_upload_package_cleanup_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp17_name_sync_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp18_name_sync_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp1_completion_audit.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp1_privacy_and_data_notes.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp1_review_materials.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp1_submission_checklist.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp2_privacy_statement.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp2_release_readiness.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp2_review_materials.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp2_school_data_sources.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp2_submission_checklist.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_admission_score_sources.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_manual_upload_guide.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_privacy_statement.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_release_readiness.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_review_materials.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_school_data_candidates.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_school_data_sources.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp4_submission_checklist.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp5_official_images/20251029142432.jpeg` | ASSET | 否 | ASSET | — | 历史来源资产，已核对类型与上传包排除 |
| `docs/mp5_official_images/2025711102122.jpeg` | ASSET | 否 | ASSET | — | 历史来源资产，已核对类型与上传包排除 |
| `docs/mp5_official_images/2025711103329.jpeg` | ASSET | 否 | ASSET | — | 历史来源资产，已核对类型与上传包排除 |
| `docs/mp5_official_pages/4199.html` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp5_official_pages/4201.html` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp5_official_pages/4202.html` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp5_official_scores_sources.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp5_scores_to_confirm.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp6_current_project_audit.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp6_final_release_readiness.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp6_manual_steps_for_user.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp6_review_submission_notes.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp6_wechat_devtools_test_checklist.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp7_final_handoff.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp7_test_result_template_for_user.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp7_wechat_upload_quick_guide.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp8_devtools_install_status.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp8_install_and_open_result.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp8_user_manual_steps.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp9_devtools_cli_status.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp9_final_user_checklist.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/mp9_user_action_required.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/post_launch_feature_candidates.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_data_safety_acceptance.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_devtools_acceptance.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_final_defects.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_final_evidence.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_final_evidence_index.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_final_execution_plan.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_final_progress.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_final_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_manual_acceptance_remaining.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_privacy_compliance_check.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_screen_size_acceptance.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_upload_package_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/prelaunch_user_journey_acceptance.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc10_full_upgrade_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc10_post_acceptance_audit.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc10_school_data_quality_matrix.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_business_rule_map.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_feature_inventory.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_full_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_legacy_reference_map.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_refresh_matrix.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_runtime_call_graph.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_1_storage_key_map.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_existing_storage_architecture.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_fault_injection_matrix.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_full_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_restore_point_spec.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_startup_recovery_rules.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_transaction_state_machine.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_2_version_conflict_rules.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_final_evidence.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_final_evidence_index.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_final_execution_plan.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_final_existing_defects.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_final_full_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc11_final_progress.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc7_1_feature_upgrade_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc7_full_upgrade_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc8_chart_vertical_alignment_hotfix_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc8_full_upgrade_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc9_full_upgrade_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/rc9_post_audit_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/score_max_740_hotfix_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_backup_restore_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_data_model_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_entity_lifecycle_matrix.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_exam_template_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_feature_freeze_manifest.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_feature_freeze_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_final_ux_convergence_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_first_release_acceptance.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_learning_loop_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_migration_report.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_recommendation_eligibility.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_report_export_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_school_user_state_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_score_rate_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_score_scheme_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_storage_transaction_spec.md` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `docs/v1_test_coverage_matrix.json` | DOC | 否 | DOC | — | 文档/历史证据，已做当前性、旧功能与敏感信息扫描 |
| `pages/backup-restore/backup-restore.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/backup-restore/backup-restore.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/backup-restore/backup-restore.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/backup-restore/backup-restore.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/help/help.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/help/help.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/help/help.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/help/help.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/home/home.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/home/home.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/home/home.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/home/home.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/privacy/privacy.js` | JS | 是 | FIXED | — | FCP-003 Clipboard、MessageFile 与主动备份发送边界已说明 |
| `pages/privacy/privacy.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/privacy/privacy.wxml` | WXML | 是 | FIXED | — | FCP-003 隐私页通用渲染已显示新说明 |
| `pages/privacy/privacy.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile-management/profile-management.js` | JS | 是 | FIXED | — | FCP-006 改名提交已执行 1—20 字符上限 |
| `pages/profile-management/profile-management.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile-management/profile-management.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile-management/profile-management.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile/profile.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile/profile.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile/profile.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/profile/profile.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/school-detail/school-detail.js` | JS | 是 | FIXED | — | FCP-002/FCP-004 新目标无 level，非法路由有空状态和返回 handler |
| `pages/school-detail/school-detail.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/school-detail/school-detail.wxml` | WXML | 是 | FIXED | — | FCP-004 非法 schoolId 显示稳定空状态和返回按钮 |
| `pages/school-detail/school-detail.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/schools/schools.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/schools/schools.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/schools/schools.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/schools/schools.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/score-trend/score-trend.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/score-trend/score-trend.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/score-trend/score-trend.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/score-trend/score-trend.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/targets/targets.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/targets/targets.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/targets/targets.wxml` | WXML | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `pages/targets/targets.wxss` | WXSS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `project.config.json` | JSON | 是 | FIXED | — | FCP-011 `.DS_Store` 上传排除改为嵌套路径也生效的后缀规则 |
| `scripts/annual_data_2027_tool.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/generate_product_rules.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/generate_rc10_school_quality_matrix.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/rc11_1_test_harness.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/rc11_2_test_harness.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/rc9_test_helpers.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/smoke_local_logic.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/smoke_page_logic.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/v1/backup-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/business-consistency-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/exam-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/learning-loop-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/migration-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/performance-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/recovery-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/release-freeze-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/school-planning-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/test-helpers.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/transaction-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/v1/ui-contract-suite.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_cross_platform_consistency.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_dual_final_hardening.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_dual_rc1_matching_flows.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_fcp_mp_first_release.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp1.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp13_2026_scores.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp17_name_sync.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp18_name_sync.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp2.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp4.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp5.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_mp6.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_prelaunch_final.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_product_rules_generated.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc10_2027_workflow.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_accessibility.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_cross_platform_backup.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_data_health.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_dynamic_help.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_full.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_goal_progress.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_learning_tasks.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_legacy_cleanup.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_loss_reasons.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_performance.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_post_audit.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_recent_history.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_school_compare.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_school_detail_trend.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_school_quality_matrix.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_score_scenarios.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_target_gap_trend.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc10_transactional_storage.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_business_rules.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_cross_platform_consistency.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_feature_inventory.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_full.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_legacy_cleanup.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_navigation.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_refresh_matrix.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_runtime_graph.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_single_data_sources.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_storage_keys.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_user_journey_first_use.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_user_journey_multi_profile.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_1_user_journey_second_exam.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc11_2_cross_platform_consistency.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_fault_injection.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_full.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_idempotency.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_operation_locks.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_profile_restore_isolation.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_restore_execution.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_restore_point_checksum.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_restore_point_creation.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_restore_point_limits.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_restore_point_model.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_restore_point_ui.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_startup_recovery.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_storage_architecture.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc11_2_version_conflicts.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc6_upgrade.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc7_1.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc7_full.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc8.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc8_chart_vertical_alignment.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_backup_restore.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_clear_data.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_exam_review.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_full.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_rc9_navigation_fusion.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_onboarding_help.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_school_filters.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_school_integration.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_score_center.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_stage_goals.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_storage_migration.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_student_profiles.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_subject_scores.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_rc9_target_center.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_score_max_740.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_upload_package_ignore.js` | JS | 否 | FIXED | — | FCP-011 已增加根目录和嵌套 `.DS_Store` 排除断言，脚本本身不进上传包 |
| `scripts/verify_v1_final_ux.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_v1_full.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `scripts/verify_v1_p1.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_v1_p2.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_v1_p3.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_v1_p4.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_v1_p5.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_v1_p6.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `scripts/verify_v1_p7.js` | JS | 否 | P2 | P2 | FCP-007 历史开发门禁仍含旧功能假设或已移除模块引用；不属于当前 release gate |
| `shared-spec/product_rules_v1.json` | JSON | 否 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `sitemap.json` | JSON | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `styles/common.wxss` | WXSS | 是 | P3 | P3 | FCP-010 小按钮触控高度偏紧，当前未构成阻断 |
| `utils/backup-restore.js` | JS | 是 | FIXED | — | FCP-001 合并最终状态已前置执行全部数量上限校验 |
| `utils/canonical-json.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/checksum.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/countdown.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/file-share.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/generated/product-rules.js` | JS | 否 | DEV_ONLY | — | 开发/测试文件，语法与当前性已审计，不进入上传包 |
| `utils/legacy/migration/storage-keys.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/operation-context.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/planning.js` | JS | 是 | LEGACY_COMPAT | P3 | FCP-008 保留大体量旧字段/旧服务兼容面；审核前不做架构重写 |
| `utils/rc11-stability.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/rc9-models.js` | JS | 是 | FIXED | — | FCP-002 旧高级字段改为输入存在才保留 |
| `utils/rc9-storage.js` | JS | 是 | LEGACY_COMPAT | P3 | FCP-008 保留大体量旧字段/旧服务兼容面；审核前不做架构重写 |
| `utils/runtime-constants.js` | JS | 是 | LEGACY_COMPAT | P3 | FCP-008 保留大体量旧字段/旧服务兼容面；审核前不做架构重写 |
| `utils/storage-migration.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/storage.js` | JS | 是 | PASS | — | 已逐文件读取或做结构/语法校验，未发现独立问题 |
| `utils/v1-domain.js` | JS | 是 | LEGACY_COMPAT | P3 | FCP-008 保留大体量旧字段/旧服务兼容面；审核前不做架构重写 |
