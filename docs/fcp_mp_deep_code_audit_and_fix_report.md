# FCP 微信小程序全仓深度审计与修复报告

- 任务：`FCP-MP-DEEP-CODE-AUDIT-AND-FIX`
- 日期：2026-08-08
- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 结论：**BLOCKED**

## 1. 审计基线

- branch：`fix/fcp-mp-deep-code-audit-fix-20260808`
- 起始 HEAD：`0900e8eb89294e8dc1b2eff762a07bafdbd871e4`
- 开始时工作树：干净，无 index lock，无其他 Git 写进程
- 外部备份：`/Users/tom/WorkData/05_Backups/FCP-MP-DEEP-CODE-AUDIT-FIX_20260808_214546`
- tracked 文件：303

## 2. 文件覆盖率

| 类型 | 数量 |
|---|---:|
| JS | 142 |
| JSON | 27 |
| WXML | 10 |
| WXSS | 12 |
| DOC | 105 |
| ASSET | 3 |
| OTHER | 4 |
| 合计 | 303 |

303/303 tracked 文件都在 `docs/fcp_mp_deep_code_audit_findings.md` 台账中，无“其余略”。

## 3. 审计方法

本轮不是抽样：先建立 `git ls-files` 清单，完成根文件、10 个页面四件套、全部 runtime utils、配置、正式数据、scripts 和 docs 审计，再形成问题清单与修复计划，最后按阶段修复。修复后从 `git ls-files` 开始完成第二遍复审。

## 4. 修复前问题总表

- P0：0
- P1：5（FCP-001 至 FCP-005）
- P2：2（FCP-006、FCP-007）
- P3：3（FCP-008 至 FCP-010）
- 第二遍另发现 P2：FCP-011（嵌套 `.DS_Store` 上传排除证据不完整）

详情、触发条件、影响、复现与回归见审计问题清单。

## 5. 修复顺序

1. 数据安全：合并恢复上限。
2. 首发数据形状：新成绩/目标不再生成旧高级字段。
3. 审核一致性：隐私说明、非法学校路由、当前人工清单。
4. 低风险 P2：改名长度、嵌套 `.DS_Store` 排除。
5. P3 不做审核前架构/视觉重写。

## 6. P0 修复

修复前没有发现 P0，历史 P0 保护仍在：`ignoreDevUnusedFiles=false`、`uploadWithSourceMap=false`，普通编译无 `module ... is not defined`、`wx://not-found`、`MaxCodeSize`、`MinTabbarCount`。

## 7. P1 修复

- FCP-001：合并最终状态在创建恢复点与写入前校验全部数量上限。
- FCP-002：旧高级字段改为“输入存在才保留”；新目标无 `level`。
- FCP-003：隐私页明确 Clipboard、MessageFile 与主动发送备份的真实用途。
- FCP-004：非法或无法 decode 的 schoolId 有 `notFound` 空状态和安全返回。
- FCP-005：人工验收清单已改为当前 AppID、10 页、五 Tab 和当前产品范围。

## 8. P2

- FIXED：FCP-006，档案改名提交限制 1—20 字符，底层 40 字符旧数据兼容上限不变。
- ACCEPTED_P2：FCP-007，历史 RC/V1 脚本保留为 DEV_ONLY，不进上传包，不恢复已删除功能。
- FIXED：FCP-011，`.DS_Store` 改为后缀排除规则，门禁覆盖根目录与嵌套路径。

## 9. P3

- DEFERRED_P3：FCP-008，保留 Schema 5 / Backup 3 / Restore Point 2 兼容层。
- DEFERRED_P3：FCP-009，2027 默认年份作为未来维护项。
- DEFERRED_P3：FCP-010，小按钮触控高度纳入真机观察，不做全局视觉改造。

## 10. 页面逐页结果

| 页面 | 代码/静态 | 模拟器 |
|---|---|---|
| home | PASS | PASS（现有 323 分记录与空目标正常） |
| schools | PASS | PASS（55 所列表正常） |
| school-detail | PASS | PARTIAL（南航苏附详情数据、来源/核对日期可见；非法 ID 未完整点击） |
| score-trend | PASS | PASS（记录页与 323 分数据可见） |
| targets | PASS | PASS（空目标状态正常） |
| profile | PASS | PASS（只有档案、备份、帮助、隐私入口） |
| profile-management | PASS | NOT_COMPLETED |
| backup-restore | PASS | NOT_COMPLETED |
| help | PASS | NOT_COMPLETED |
| privacy | PASS | NOT_COMPLETED |

## 11. Utils

全部正式 runtime utils 已逐文件检查。`storage`、`backup-restore`、`rc9-models`、`storage-migration`、`rc11-stability`、`planning`、`countdown`、`file-share`、`checksum`、`canonical-json`、`operation-context` 的当前调用链、错误处理和兼容边界已复审；正式 require 图无缺失模块或循环依赖。

## 12. Storage

- 10 档案、100 成绩、100 目标边界与满额编辑 PASS。
- 合并后第 11 档案、第 101 成绩、第 101 目标都返回 `LIMIT_EXCEEDED`。
- 失败前后业务状态和恢复点深相等，不静默 `slice`，不丢数据。
- 自动档案隔离、写失败/回滚、migration 与 crash recovery 门禁 PASS。

## 13. Backup

Backup 3、Schema 5、Restore Point 2 保持。4 MB 在 `readFileSync` 前拒绝；旧单科、复盘、学习、收藏、对比、状态和教程数据可导出、校验并恢复。MessageFile 仅由用户主动选择备份触发。模拟器的选择取消/导出发送仍待人工点击。

## 14. 学校数据

55 所；schoolId 唯一；正式学校数文件未修改。学校列表在 DevTools 显示“找到 55 所学校”。

## 15. 历史分数

2025 = 103，2026 = 43，总计 146，`>740 = 0`；ID、schoolId 引用、分值与字段结构通过专用验证。

## 16. 成绩

新增/编辑/删除、0—740、第 101 条拒绝和原始 storage 形状自动门禁 PASS。模拟器可见现有“成绩分析”323 分记录；未在本轮删除或覆盖它。模拟器完整 CRUD 未完成。

## 17. 趋势图

0/1/2/10/11/100 条数据逻辑与最近 10 条限制通过自动门禁，无 NaN/Infinity 路径。模拟器完整趋势交互未完成。

## 18. 目标

新目标不再生成 `level`；差值只是 `currentScore - historicalReferenceScore`；第 101 目标与合并超限保护 PASS。DevTools 空目标状态 PASS，加入/移除未完成当前点击证据。

## 19. 多档案

自动门禁已覆盖创建、切换、隔离、删除、10/11 边界与满额原状态保护。DevTools 双档案状态矩阵未完成。

## 20. 隐私

最终正式调用为用户主动 `wx.setClipboardData`、`wx.chooseMessageFile` 和备份本地文件读写/发送。未发现 `wx.getClipboardData`。代码与微信后台 Clipboard / MessageFile 声明一致。隐私页当前点击证据未完成。

## 21. 人工客服

- 邮箱：`3341251927@qq.com`
- 微信：`shsz1610`
- 代码、WXML 与自动门禁字符串一致；模拟器实际剪贴板值未完成。

## 22. 权限与网络

| 能力 | 结果 |
|---|---|
| 登录 / getUserProfile / 手机号 | 未发现 |
| 定位 / 地图定位 | 未发现 |
| 支付 / 订阅消息 | 未发现 |
| 广告 / 统计 SDK | 未发现 |
| 云开发 / 云函数 | 未发现 |
| `wx.request` / upload / download | 未发现业务调用 |
| 第三方 SDK | 未发现 |

## 23. 上传包

- `uploadWithSourceMap=false`
- tracked/private 两份 `ignoreDevUnusedFiles=false`
- docs、scripts、shared-spec、generated rules、README、`.DS_Store` 等被排除
- 静态估算：67 个文件，442,752 字节（约 0.422 MiB）
- 最大文件：`utils/rc9-storage.js`，123,590 字节
- DevTools 实际上传包分析和体验版上传未执行

## 24. Sitemap

无 `allow *`；只允许公开信息页并以 `disallow *` 收尾；档案、成绩、目标和备份页不对外索引。

## 25. 自动测试

以下全部 PASS：

- `node scripts/verify_fcp_mp_first_release.js`（13 TEST-ID）
- `node scripts/verify_dual_final_hardening.js`
- `node scripts/verify_dual_rc1_matching_flows.js`
- `node scripts/verify_v1_final_ux.js`
- `node scripts/verify_rc9_full.js`
- `node scripts/verify_v1_full.js --all-verify`（7 个当前 release gates）
- `node scripts/smoke_local_logic.js`
- `node scripts/smoke_page_logic.js`
- `node scripts/verify_upload_package_ignore.js`
- 142 个 JS `node --check`
- 27 个 JSON 解析
- `git diff --check`

## 26. DevTools

- 工具：微信开发者工具 RC 2.02.2607171
- 路径与 AppID：正确
- 基础库：3.7.12
- 普通编译：PASS
- Problems：0
- Console：无业务 Error，无历史 P0 关键字；存在开发者工具自身“自动热重载已开启”提示
- 五 Tab：首页、学校库、成绩、目标、我的均已到达
- 完整状态矩阵与核心交互：**NOT_COMPLETED**

## 27. 正式数据

| 文件 | SHA-256 |
|---|---|
| `data/schools.js` | `c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2` |
| `data/admission-scores.js` | `0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88` |
| `data/admission-scores-2026.js` | `3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c` |

55 / 103 / 43 / 146 / `>740=0`，AppID = `wxc2a2a94f767438dd`，与开始前一致。

## 28. Git

- branch：`fix/fcp-mp-deep-code-audit-fix-20260808`
- commit：未创建
- push：未执行
- status：有本轮明确修改和新建审计文档，无 staged 文件
- 原因：附件要求“完整 DevTools 模拟器 PASS”后才允许提交和普通 push，当前该硬门槛尚未满足

## 29. 剩余 P0

0。

## 30. 剩余 P1

0。

## 31. 剩余已知问题

- ACCEPTED_P2：历史 DEV_ONLY 脚本仍可能单独失败，不属当前 release gate，不进上传包。
- DEFERRED_P3：旧备份兼容表面、2027 默认年份、小按钮触控高度。
- 人工验收缺口：搜索/筛选、非法详情路由、成绩 CRUD/趋势、目标加入/移除、双档案、客服剪贴板、备份取消/导出、隐私页、iPhone 8 Plus 小屏矩阵。
- 真机、体验版上传、微信审核和发布均未执行；这些不能由自动门禁或旧证据代替。

## 32. 最终结论

**BLOCKED**

代码审计、P0/P1 修复、自动门禁、普通编译、Problems=0、五 Tab 和正式数据保护已通过。但完整 DevTools 状态矩阵/核心交互、工作树干净、commit 和普通 push 尚未满足，因此不得给出 `READY_FOR_FINAL_MANUAL_ACCEPTANCE`。

### 回滚

- 文件级：从外部备份的 `individual/` 目录恢复对应 `*.bak_YYYYMMDD_HHMMSS`。
- 整体级：从外部全量备份恢复本轮前版本。
- 若后续已提交：使用普通 `git revert <commit>`。
- 不使用 reset、clean、rebase 或 force push。
