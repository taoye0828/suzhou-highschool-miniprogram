# 苏程记录

苏程记录是一个纯本地微信小程序，用于记录成绩、复盘学习过程、整理高中目标，并基于用户选择的合格 740 分考试与学校历史公开分数线提供“历史分差参考”。它不做录取预测，不提供志愿填报结论。

## 正式身份与导航

- 正式名称：苏程记录
- 正式 AppID：`wxc2a2a94f767438dd`
- 正式五个 Tab：首页、学校库、成绩、目标规划、我的
- 公开版本号：2.0.0（本轮未擅自修改）
- 当前安全代码/测试 HEAD：`1bd7459d29db3a6e03994513371e90ff78a39a18`；其后的冻结证据提交只更新文档与进度，最终 HEAD 以 `git rev-parse HEAD` 为准

## V1 included 功能

- 学校库：搜索、组合筛选、详情、收藏、目标学校、候选状态、标签、备注、最近浏览、最多 3 校对比。
- 成绩：考试记录、考试模板、分值方案、历史方案快照、不同满分、原始分/得分率/学科趋势、复盘、失分原因和错题。
- 目标规划：历史分差参考、主要目标、情景规划、学习任务、周计划、多指标阶段目标和阶段复盘。
- 我的：多学生档案、考试设置、Backup v3 导出/导入/主动分享、Restore Point v2、数据管理、数据检查、启动恢复、纯文本/JSON 报告、数据与隐私说明。
- 首页：当前进展、最近成绩、参考成绩、主要目标、本周任务、阶段目标、全局搜索和高频入口。

所有用户数据只保存在本机。备份或报告只有在用户主动点击发送并确认数据范围与隐私提示后，才通过微信系统能力交给用户选择的接收方；取消不记录为成功，失败不修改用户数据。

## 数据结构与安全

- Storage Schema v5，兼容读取 Schema v4。
- Backup v3 使用 canonical JSON + SHA-256，兼容读取 Backup v2 FNV-1a。
- Restore Point v2 使用统一 SHA-256，兼容读取 Restore Point v1。
- 写操作统一经过 OperationContext、幂等、操作锁、事务日志、最终回读和 dataRevision；页面不直接写正式 Storage。
- 危险操作前创建恢复点；单档案恢复默认不修改共享收藏；删除档案后可恢复为新档案。
- operation state 最多 100 条、单条不超过 2048 字节，不保存完整用户状态、payload、备份或报告。

## 历史分差与不同满分

`difference = userScore - referenceScore`：

- 冲刺：`-30 <= difference < 0`
- 目标：`0 <= difference <= 15`
- 保底：`difference > 15`
- 每组最多 5 所学校

只有 `full_total`、`totalMaxScore = 740`、`admissionScaleMax = 740`、资格规则允许、方案快照完整、总分合法且数据健康无阻断的考试能用于历史分差参考。周测、单科、部分学科、非 740 方案、得分率、自动换算值和快照缺失记录均不可使用。其他满分考试仍可显示原始分和得分率，但不会自动换算成 740。

分组仅根据用户选择的历史成绩与学校历史公开分数线计算分差，不考虑招生计划、排名、指标生、批次变化、政策变化和当年试卷难度，不构成录取判断或志愿建议。

历史公开数据整理，仅供目标规划参考。

## 正式数据

- 正式学校数据：55 条
- 2025 年历史分数线：103 条
- 2026 年历史分数线：43 条
- 历史录取分数线：146 条
- 正式 2027 年分数线：0 条
- 当前完整中考体系最高分：740

当前收录 2025、2026 年官方历史分数线，所有条目均保留来源与核对信息。

2027 候选资料只用于开发维护，位于 `docs/` 与 `scripts/`，不接入正式运行页面，并被上传包排除。

## excluded 功能

V1 不包含登录/注册/手机号/openid/unionid、后台、云开发、Supabase、AI、网络推荐、自动上传、云同步、支付、广告、定位、推送、统计 SDK、社区、公开排名、图片上传、PDF、PIN、Face ID、Touch ID 或正式 2027 数据。

## 测试与冻结状态

- V1 自动测试：92 个核心 TEST-ID + 11 个冻结 TEST-ID，共 103 个唯一 TEST-ID。
- 历史回归：85 个已有 `verify_*.js`、两个 smoke、全仓 JavaScript/JSON、上传包、身份/禁用能力、产品规则和正式数据 raw/semantic hash 全部通过。
- 代码状态：`V1_CODE_FREEZE_READY`。
- 体验状态：`PRE_RELEASE_UX_FREEZE_CONFIRMED = false`。

自动测试不能替代微信开发者工具和人工验收。最终 RC11 提交仍需完成：普通编译、Problems 0、Console 无业务错误、320/375/390/414/430/iPad、多页面真实点击、备份和报告真实发送、恢复点、多档案、手机预览；体验版上传和审核还需要用户授权。

代码冻结后，上架前只处理布局、视觉、文案、操作步骤、空/加载/错误状态、安全区、多尺寸/iPad、性能、卡顿、崩溃、数据丢失缺陷、审核合规、真机问题、正式官方数据更新和上架材料。新业务建议只记录到 `docs/post_launch_feature_candidates.md`。

## MP12 页面收口兼容说明

早期 MP12 已移除开发阶段用户文案，并用上传包规则排除开发资料；当前 V1 继续保留这些门禁，但以本 README 的冻结范围、正式身份和人工验收状态为准。

## 证据与验证

- 完整报告：`docs/rc11_final_full_report.md`
- 机器证据：`docs/rc11_final_evidence.json`
- 证据索引：`docs/rc11_final_evidence_index.md`
- 测试覆盖：`docs/v1_test_coverage_matrix.json`
- 生命周期：`docs/v1_entity_lifecycle_matrix.json`
- 功能冻结：`docs/v1_feature_freeze_manifest.json`

完整验证入口：

```bash
node scripts/verify_v1_full.js --all-verify
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

## 回滚

撤销某个逻辑提交使用普通 `git revert <commit-sha>`。单文件可从仓库外备份 `/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC11_FINAL_MP_20260801_162207` 恢复后重新验证。不要使用 reset、clean、rebase、stash、amend 或 force push。
