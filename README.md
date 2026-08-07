# 苏程记录微信小程序

苏程记录是一个纯本地微信小程序，帮助苏州家长和学生查询学校与历史公开录取分数线、记录考试总分，并把当前总分与手动选择的目标学校做数字对照。历史数据仅供了解，不代表未来录取结果。

## 首发核心功能

- 学校名称、简称和区域查询；
- 2025、2026 年历史公开录取分数线及来源信息；
- 考试名称、日期和 0—740 总分记录；
- 最近最多 10 条总分趋势；
- 手动加入或移出目标学校；
- 当前总分与目标学校历史参考分的数学差值；
- 最多 10 个学生档案，成绩与目标学校彼此独立；
- 本机数据备份、合并恢复、替换恢复和数据清理；
- 静态使用说明、常见问题、隐私说明与人工客服联系方式。

正式导航固定为五个 Tab：首页、学校库、成绩、目标、我的。`app.json` 只注册 10 个正式页面。

## 首发不包含

首发不包含自动推荐、冲刺/目标/保底分类、录取概率、单科成绩、考试模板、分值方案、排名、得分率、考试复盘、错题、学习任务、周计划、阶段目标、学校收藏、学校对比、个人标签、个人备注、全局搜索、报告、自动教程或用户可见的技术维护页面。

小程序也不接入登录、手机号、openid、unionid、后台、云开发、Supabase、AI、支付、广告、定位、地图 SDK、推送、统计 SDK 或云同步。

## 本地数据与兼容性

- 用户数据默认只保存在微信小程序本机存储；
- 新成绩只写入考试名称、日期和总分；
- 最多 100 条成绩、100 所目标学校，达到上限时明确拒绝新增并保留原数据；
- 备份文件最大 4 MB，导入前先做大小与结构校验；
- 当前兼容 Storage Schema 5、Backup Format 3、Restore Point Format 2；
- 旧备份中的单科、复盘、错题、学习任务、周计划、收藏、对比、学校个人状态和教程字段仍可安全解析与恢复，但不会重新出现在正式 UI。

危险数据操作继续使用事务保护和失败回滚。普通用户界面不会显示 Schema、checksum、Restore Point、内部路径或 operation id 等维护术语。

## 正式数据基线

- 学校：55 所；
- 2025 年历史分数线：103 条；
- 2026 年历史分数线：43 条；
- 合计：146 条；
- 超过 740 分：0 条；
- AppID：`wxc2a2a94f767438dd`。

正式数据文件的 SHA-256 基线记录在 `scripts/verify_fcp_mp_first_release.js`，不得在功能收口任务中漂移。

## 上传包边界

`project.config.json` 必须保持：

- `ignoreDevUnusedFiles: false`，避免开发者工具错误裁剪运行时模块；
- `uploadWithSourceMap: false`；
- `docs/`、`scripts/`、`shared-spec/`、`utils/generated/`、README、Git 元数据和常见开发产物不进入微信上传包。

Sitemap 只允许首页、学校库、学校详情、帮助和隐私页面被索引；成绩、目标、我的、档案和备份恢复等个人数据页面不公开索引。

## 验证

核心验证命令：

```bash
node scripts/verify_fcp_mp_first_release.js
node scripts/verify_dual_final_hardening.js
node scripts/verify_dual_rc1_matching_flows.js
node scripts/verify_v1_final_ux.js
node scripts/verify_rc9_full.js
node scripts/verify_v1_full.js --all-verify
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
node scripts/verify_upload_package_ignore.js
find . -name "*.js" -not -path "./node_modules/*" -print0 | xargs -0 -n1 node --check
git diff --check
```

自动脚本、微信开发者工具普通编译、模拟器人工验收、真机调试、体验版上传和审核是不同证据层级，必须分别记录，不能互相替代。

## 文档与回滚

本轮范围与证据见 `docs/fcp_mp_first_release_consolidation_report.md`。

代码回滚使用普通 `git revert <commit-sha>`。文件级恢复可使用本轮仓库外备份：

`/Users/tom/WorkData/05_Backups/FCP-MP-FIRST-RELEASE-CONSOLIDATION_20260807_183721`

不要使用 `reset`、`clean`、`rebase`、`git add .` 或 force push。
