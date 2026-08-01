# RC11-FINAL-MP 执行计划

## 边界与起点

- 任务：RC11-FINAL-MP（同一长期开发轮次，不拆分新业务轮次）。
- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`，分支 `main`。
- 开始 HEAD / origin/main：`217c55af2c55e061f7e28fa064c9d738596cc204`，ahead/behind `0/0`。
- Flutter 仓库不修改、不提交、不作为本轮完成项。
- 正式数据只读不变量：学校 55、2025 年 103、2026 年 43、合计 146、正式 2027 为 0、上限 740。
- 仓库外快照：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC11_FINAL_MP_20260801_162207`。
- 起点分支：`backup/rc11-final-start-20260801-217c55a`（已普通推送）。

## 已有实现复用结论

以下模块属于 `ALREADY_COMPLETED_VERIFIED` 的基础能力，本轮扩展而不复制：

- `utils/rc9-storage.js`：唯一正式 Storage、事务入口、版本化用户数据根、恢复点调用链。
- `utils/rc9-models.js`：唯一 profileData 模型和归一化入口。
- `utils/storage-migration.js`：唯一 Schema 迁移链。
- `utils/backup-restore.js`：唯一备份导入导出链。
- `utils/rc11-stability.js`：现有恢复点纯函数与故障注入基础。
- `utils/data-health.js`：唯一数据健康检查/修复入口。
- `utils/planning.js`、`utils/score-analysis.js`：现有历史分差计算链。
- 五个正式 Tab、现有二级页面与 `utils/storage.js -> utils/rc9-storage.js` 兼容出口。

历史 RC11-1、RC11-2、RC9、RC10、smoke 和上传排除基线在开始时通过；它们是回归基线，不替代本轮新故障边界测试。

## 新文件唯一职责

| 新文件 | 现有文件不能单独承担的原因 | 唯一职责 | 调用方 / 被调用方 | 防旁路与测试 |
| --- | --- | --- | --- | --- |
| `shared-spec/product_rules_v1.json` | 现有规则散落在 JS 与页面，无法机器校验唯一来源 | 唯一权威产品规则与限制 | 生成器读取；不直接写用户数据 | 生成一致性测试、上传排除测试 |
| `utils/generated/product-rules.js` | 微信运行代码需要确定性 JS 常量 | 规则 JSON 的生成产物 | models/storage/domain/pages 只读 | 禁止手改；生成器哈希校验 |
| `scripts/generate_product_rules.js` | 无现成规则生成链 | 生成上述 JS | 读取 shared-spec，写 generated | 产物复现测试 |
| `scripts/verify_product_rules_generated.js` | 历史测试不校验规则漂移 | 检查 JSON/JS 一致 | 只读两份规则 | 篡改用例 |
| `utils/canonical-json.js` | 现有 SHA/canonical 内嵌于恢复点且备份另用 FNV | 全项目唯一 canonical JSON | checksum、备份、恢复点、哈希工具 | 数值/危险对象/深度测试 |
| `utils/checksum.js` | 备份和恢复点当前两套摘要 | 唯一 SHA-256 出口，保留 v2 FNV 只读适配 | backup、restore point、开发哈希 | v2/v3 兼容与篡改测试 |
| `utils/operation-context.js` | 页面当前临时拼 operationId 且可为空 | 创建/复用稳定 OperationContext | 页面 -> storage service | 生产入口静态扫描与幂等测试 |
| `utils/local-date.js` | 业务日期散落且部分 UTC 截取 | 本地自然日/周一到周日 | home/score/targets/domain | 固定时钟与时区边界测试 |
| `utils/v1-domain.js` | 新实体纯归一化、资格、趋势、搜索/报告不应塞入页面或直接写存储 | 纯业务函数，不持久化 | storage/pages/reports 调用；读取 product rules | 纯函数和规模性能测试 |
| `utils/file-share.js` | 现有导出只写沙盒，无统一主动分享语义 | FileShareAdapter 与取消/失败分类 | backup/report 页面调用微信系统能力 | mock 分享成功/取消/失败/重试 |
| `pages/exam-settings/*` | 模板/方案是“我的”下独立低频配置，现有成绩表单不适合承担完整 CRUD | 模板与分值方案正式入口 | 只调用 storage service | UI contract + 页面 smoke |
| `pages/global-search/*` | 五 Tab 页面都不应持有跨实体查询 UI | 当前档案本地搜索入口 | 调用 v1-domain + storage 只读 | 档案隔离与性能测试 |
| `pages/reports/*` | 报告选择、预览、文件分享不属于现有备份页面 | 文本/JSON 报告正式入口 | domain snapshot + file-share | 内容、隐私、取消/失败测试 |
| `scripts/v1/*`、`scripts/verify_v1_full.js` | 历史脚本不覆盖最终契约 | 有 TEST-ID 的分套件验证 | 只读/内存 wx mock | 每项输出 ID、结果、耗时 |

新增文件不建立第二套事务、存储、用户数据根、备份、恢复点或历史分差算法。所有持久化必须回到 `utils/rc9-storage.js`；页面禁止直接调用 `wx.*Storage*`。

## 九阶段执行

### P0 安全、审计与备份

- P0-S01～S05：Git/并发/远端/外部快照/起点分支。
- P0-S06：本计划、D001—D044 审计、开始哈希、基线回归。
- 测试：P0-GIT、P0-DATA、现有 RC11-1/RC11-2/RC9/RC10/smoke。
- 提交：`chore: audit miniprogram V1 release freeze scope`。

### P1 事务、幂等、操作锁和启动恢复

- 扩展 `atomicWrite` / `atomicRemove` 为统一 TransactionResult；提交后清理失败只能是 committed_with_warning。
- 引入 dataRevision 单调语义、OperationContext、强制 service lock/idempotency、紧凑 operation state。
- 明确 removing 的 expectedAfter 与 committed journal；启动恢复自动/人工状态分流。
- 危险清除和删除前创建新恢复点；single_profile 默认不改共享收藏并支持恢复为新档案。
- 测试：V1-TXN、V1-LOCK、V1-RECOVERY。
- 提交：`fix: close miniprogram transaction and recovery defects`。

### P2 规则源、Schema、Backup、Restore Point

- 生成唯一规则 JS；扩展现有 profileData，Schema v4 -> v5 幂等迁移，旧成绩无损补快照。
- Backup v3 用统一 SHA-256，v2 FNV 只读兼容；Restore Point v2 写入、v1 适配读取。
- 导入大小/深度/实体/危险键/版本/checksum 门禁；合并按实体唯一键、version、updatedAt。
- 测试：V1-MIGRATION、V1-BACKUP、恢复点版本门禁。
- 提交：`feat: migrate miniprogram user data to schema v5`。

### P3 现有业务一致性

- 成绩+复盘单事务；目标更新保留未提供字段；主要目标不自动替换。
- 删除阶段目标清理任务引用；reviewId/sourceLossReasonId 关联规则；收藏不自动清理。
- 统一本地日期、动态正式年份、真实 hasBackup、学科配置版本、历史 maxScore。
- 固定历史分差边界并分离情景分数；提供恢复正式参考成绩入口。
- 测试：V1-DATA 与相关 RC9/RC10 回归。
- 提交：`fix: close miniprogram existing business consistency defects`。

### P4 考试模板、分值方案和趋势

- 内置模板/740 方案只由规则源提供；自定义模板/方案 CRUD、复制、引用统计和版本冲突。
- 考试保存不可变方案快照、不同满分、basis points 得分率与历史分差资格。
- 原始分/得分率/学科趋势共用 x 轴，最近 10 条。
- 测试：V1-EXAM、V1-TREND 固定案例。
- 提交：`feat: add miniprogram exam templates score schemes and score rates`。

### P5 学习闭环

- 错题 CRUD；复盘/失分原因/错题/任务双向关联单事务。
- 周计划（本地周一至周日）、多指标阶段目标、不可变阶段复盘快照。
- 测试：V1-LEARNING、多档案隔离。
- 提交：`feat: complete miniprogram learning execution loop`。

### P6 学校规划、搜索和报告

- schoolUserStates、状态/标签/备注、最终筛选与对比用户维度。
- 当前档案全局搜索，不持久化索引。
- 成绩阶段与目标学校 text/JSON 报告；不可变快照；主动分享前摘要和隐私提醒。
- 2027 只完善开发维护工具，绝不接正式运行数据。
- 测试：V1-SCHOOL、V1-SEARCH、V1-REPORT。
- 提交：`feat: complete miniprogram school planning search and reports`。

### P7 页面、数据健康和性能

- 三个允许的新二级页接入 app.json，其他功能融合现有成绩/目标/学校/我的页面。
- loading/empty/error/saving/冲突/刷新/重复点击契约。
- 数据健康覆盖新实体、引用、版本、operation/journal；修复前恢复点。
- 性能与 setData 预算测试。
- 提交并入对应功能提交或单独 `fix: connect miniprogram V1 production entry points`。

### P8 测试、证据、推送与冻结

- V1 全套、RC11-2、RC11-1、全部历史 verify、smoke、全仓 JS/JSON、包排除、身份/隐私/数据哈希。
- 生成覆盖矩阵、生命周期矩阵、冻结清单、机器证据、完整报告与 README。
- 逐文件暂存，普通提交/推送；创建并推送最终冻结备份分支。
- 只有 Git 与全部代码门禁成立才写 `V1_CODE_FREEZE_READY`；微信开发者工具和人工路径另行决定 `PRE_RELEASE_UX_FREEZE_CONFIRMED`。

## 数据迁移顺序

1. 启动恢复和锁清理；2. v4 完整快照和 before_migration 恢复点；3. 内存归一化 v5；4. 旧成绩补 740 方案快照；5. 新字段初始化；6. operation state 压缩；7. legacyExtensions 白名单；8. 临时写入与回读；9. 引用/限制/checksum 校验；10. 正式提交并增加 revision；11. 最后写 Schema v5；12. 清理临时状态。重复运行只能返回 applied:[]，不得重复插入内置或用户实体。

## 性能预算

以规则源为准：搜索 80/200ms、报告 300/1000ms、备份 1000/3000ms、数据检查 1500/4000ms（中位数/最大）；单次 setData <= 204800 字节。页面只持有展示切片。

## 回滚与风险

- 逻辑提交按阶段完成；本轮撤销使用 `git revert <sha>`，不 reset/rebase/clean/stash/amend/force push。
- 单文件可从外部快照 `snapshot/` 恢复；Git 起点分支只作保护，不切换。
- 正式数据 semantic hash 变化、未知并发、远端双向分叉、无法确认旧迁移语义或真实用户数据不可逆风险均为硬阻断。
- 微信开发者工具登录、扫码、上传体验版和提交审核需要人工权限；自动测试不能替代。

