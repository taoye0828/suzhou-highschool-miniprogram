# FCP 微信小程序深度审计修复计划

- 日期：2026-08-08
- 基线：`0900e8eb89294e8dc1b2eff762a07bafdbd871e4`
- 分支：`fix/fcp-mp-deep-code-audit-fix-20260808`
- 依据：`docs/fcp_mp_deep_code_audit_findings.md`
- 原则：P0/P1 全部修复；P2 仅处理低风险首发可见问题；P3 不做审核前架构重写。

## Phase 1：数据安全与首发数据形状

### 1.1 修复 FCP-001 合并恢复上限

- 修改：为最终导入状态增加统一上限校验；在创建导入安全恢复点和正式写入前先计算并拒绝超限 nextState。
- 原因：防止两个各自合法的数据集合在 merge 后突破 10 档案、100 成绩、100 目标。
- 依赖：无，最高优先级。
- 风险：若校验放得过晚会留下多余恢复点；若静默截断会丢数据。因此必须前置拒绝，不能 slice。
- 测试：新增合并后第 11 档案、第 101 成绩、第 101 目标拒绝；边界值和编辑/重合 ID 合并仍通过；失败前后 storage 深相等。
- 回滚：恢复 `utils/backup-restore.js` 备份，或对本轮提交执行普通 `git revert`。

### 1.2 修复 FCP-002 新记录旧字段生成

- 修改：normalizer 对旧高级字段改为“输入存在才保留”；正式新增成绩/目标不再主动写旧高级字段或目标等级。
- 原因：首发核心数据应只产生名称、日期、总分与普通目标关系，同时继续读取旧备份。
- 依赖：先明确旧备份回归样本，再改 normalizer。
- 风险：错误删掉历史字段会破坏旧备份；必须验证旧 subjectScores、review、learning、favorites、comparison、tutorial 等仍往返。
- 测试：原始 storage 形状断言 + FCP 旧数据兼容门禁。
- 回滚：恢复 `utils/rc9-models.js`、`pages/school-detail/school-detail.js` 备份。

## Phase 2：审核一致性与核心页面

### 2.1 修复 FCP-003 隐私说明

- 修改：增加剪贴板、选中文件、主动发送备份的真实用途和边界说明。
- 原因：与代码和微信后台 Clipboard / MessageFile 声明一致。
- 依赖：不得移除现有复制、选择文件、恢复和发送备份能力。
- 风险：绝对化文案可能与主动分享冲突；采用“不会自动/后台读取或上传”的准确表述。
- 测试：FCP 文案断言 + 隐私 API 全扫描。
- 回滚：恢复 `pages/privacy/privacy.js` 备份。

### 2.2 修复 FCP-004 非法详情路由空白

- 修改：增加 `notFound` 状态、空状态卡和返回操作。
- 原因：深链或失效 schoolId 不应出现白屏。
- 依赖：不改变合法详情和目标流程。
- 风险：返回栈为空时 `navigateBack` 可能无效；提供返回学校库的安全回退。
- 测试：合法/非法 options 页面逻辑、handler 对齐、模拟器路由。
- 回滚：恢复 school-detail JS/WXML 备份。

### 2.3 修复 FCP-005 当前人工验收清单

- 修改：用当前 AppID、10 页、五 Tab、核心状态矩阵、Clipboard/MessageFile、真机/上传/审核分层重写通用清单。
- 原因：避免按旧产品做错误验收。
- 依赖：以本轮最终代码和自动门禁为准。
- 风险：不得把未执行的真机、体验版上传或审核写成完成。
- 测试：旧 AppID和已删除功能指令扫描。
- 回滚：恢复文档备份。

## Phase 3：低风险 P2

### 3.1 修复 FCP-006 改名长度

- 修改：editable modal 提交时校验 1–20 字符。
- 原因：与新建入口一致，降低长昵称布局风险。
- 依赖：底层兼容上限继续 40，不触碰旧数据。
- 测试：20 允许、21 拒绝。
- 回滚：恢复 profile-management JS 备份。

### 3.2 接受 FCP-007 历史开发脚本

- 修改：不恢复已删除功能，不让旧测试进入当前 release gate；在审计文档和最终报告中明确 DEV_ONLY/ACCEPTED_P2。
- 原因：机械重写全部历史证据脚本会扩大审核前变更面；它们已被上传包排除。
- 风险：单独运行旧脚本仍可能失败；当前唯一发布门禁必须以 README/FCP/full runner 明确列表为准。
- 测试：`verify_v1_full.js --all-verify` 只运行当前 7 个 release gates；上传包继续排除 scripts。
- 回滚：无业务代码修改。

## Phase 4：P3 决策

- FCP-008：DEFERRED_P3，保留 Schema 5 / Backup 3 / Restore Point 2 兼容层。
- FCP-009：DEFERRED_P3，2027 默认年份作为未来维护项。
- FCP-010：DEFERRED_P3，触控高度通过模拟器/真机观察，不做全局视觉重构。

## 分阶段验证顺序

1. Phase 1 后：新增数据安全回归、FCP gate、dual hardening、storage/backup smoke。
2. Phase 2 后：页面 handler、隐私 API、路由、文档 currentness、FCP gate。
3. Phase 3 后：页面 smoke、全量当前 release gates。
4. 最终：第二遍 `git ls-files` 清单复审、全部 JSON 解析、全部 JS `node --check`、`git diff --check`、正式数据哈希/数量/AppID、上传包估算与 ignore gate。
5. 微信开发者工具：清空 Console/Problems，普通编译，五 Tab、状态矩阵与核心交互回归。
6. 只有 P0=0、P1=0、自动门禁和模拟器通过、数据不变，才允许明确文件暂存、提交、普通 push。

## 整体回滚

- 外部备份：`/Users/tom/WorkData/05_Backups/FCP-MP-DEEP-CODE-AUDIT-FIX_20260808_214546`
- 文件级：使用本轮每个待改文件的 `原文件名.bak_YYYYMMDD_HHMMSS` 外部备份。
- 提交级：普通 `git revert <本轮提交 SHA>`。
- 禁止：reset、clean、rebase、force push、覆盖 main。
