# FCP 微信小程序首发收口报告

日期：2026-08-07

## 1. 开始状态

- 只处理仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`；Flutter 仓库未修改。
- 起始分支：`fix/fcp-mp-p0-runtime-repair-20260807`。
- 起始 HEAD：`0e26ed499f98dbcc00e6c574e1a7a321cf93ce08`。
- 工作分支：`fix/fcp-mp-first-release-consolidation-20260807`。
- 开始时唯一 dirty 是 `project.config.json` 的文件末尾换行差异，没有未知业务修改；无 `.git/index.lock`。
- 完整仓库外备份：`/Users/tom/WorkData/05_Backups/FCP-MP-FIRST-RELEASE-CONSOLIDATION_20260807_183721`。
- README 追加备份：`/Users/tom/WorkData/05_Backups/README.md.bak_20260807_190136`。

## 2. P0 保护

- `project.config.json` 和本机 `project.private.config.json` 均保持 `ignoreDevUnusedFiles: false`。
- `uploadWithSourceMap` 已从 `true` 改为 `false`，没有重新开启 unused-file runtime pruning。
- 最终普通编译 Problems 为 0；`module ... is not defined`、`wx://not-found`、`MaxCodeSize`、`MinTabbarCount` 均未复发。

## 3. 页面变化

- 修改前：20 个注册页面。
- 修改后：10 个注册页面，且 `app.json` 与真实页面目录完全一致。
- 删除：`target-analysis`、`school-compare`、`web-view`、`favorites`、`data-info`、`data-management`、`restore-points`、`exam-settings`、`global-search`、`reports`。
- 五个 Tab 保持：首页、学校库、成绩、目标、我的。

## 4. 删除功能

已按入口、路由、WXML、handler、页面 data、工具、配置、帮助文案、测试和上传包完整收口：

- 自动教程：删除 overlay 组件、教程工具、步骤、重播和跨 Tab 引导；
- 考试高级：删除考试模板、分值方案、考试类型、排名、得分率和单科 UI；
- 复盘/错题：删除复盘、失分原因、错题及其任务联动；
- 学习：删除学习任务、周计划、阶段目标和阶段复盘；
- 推荐：删除情景、冲刺/目标/保底分类、自动推荐和录取可能性；
- 高级目标：删除目标等级、主要目标、分差轨迹和解释性判断；
- 收藏、学校对比、学校个人状态、最近浏览/操作/对比；
- 全局搜索、报告、用户可见数据健康/恢复点/技术维护；
- WebView、飞书问卷、旧反馈链接和反馈状态链。

## 5. 保留功能

- 学校查询与简单筛选；
- 2025、2026 年历史公开录取分数线、来源和核对日期；
- 手动目标学校；
- 考试名称、日期和 0—740 总分；
- 最近最多 10 条总分趋势；
- 当前总分与目标学校历史参考分的数学差值；
- 最多 10 个互相独立的学生档案；
- 本地备份恢复、事务保护和失败回滚；
- 静态帮助、六项 FAQ、人工客服和隐私说明。

## 6. 首页

最终只显示当前档案、中考倒计时、最近成绩、目标学校、记录成绩和查找学校。模拟器确认没有推荐、学习任务、阶段目标、全局搜索、教程 Overlay 或版本卡。

## 7. 学校库

保留学校名称/简称搜索、区域、学校类型、参考年份、分数范围和简单排序；学校卡只显示名称、区域、类型、最近参考分/年份和轻量“已加入目标”。模拟器显示 55 所学校，搜索“南航苏附”返回 2 所。

## 8. 学校详情

保留基础学校信息、历史公开分数线、来源、核对日期、复制学校名称、复制地图搜索词、复制来源链接及加入/移出目标。模拟器核对南京航空航天大学苏州附属中学：地图搜索词复制为学校全名，来源链接复制为 `https://news.2500sz.com/doc/2026/07/06/1218216.shtml`。

## 9. 成绩

表单只包含考试名称、考试日期和总分。记录卡只显示名称、日期、总分、编辑和删除；趋势最多 10 条，并保留最近总分、最高分和平均分。模拟器临时记录完成编辑、趋势和删除，用户原有“成绩分析 / 323 分”保持不变。

## 10. 目标

目标页只显示最近一次总分、学校名称、历史参考年份、历史公开参考分、当前总分和数字差值，不解释录取概率。模拟器临时加入学校后显示 2026 年、583 分、当前 323 分、差值 -260，随后已移出并恢复为 0 所目标学校。

## 11. 我的

只保留当前学生档案、学生档案管理、数据备份与恢复、使用说明与常见问题和隐私说明。新建临时档案后确认成绩和目标均为空且与默认档案独立；随后切回默认档案并删除临时档案，原 323 分记录仍在。

## 12. 人工客服

- 邮箱：`3341251927@qq.com`；点击“复制邮箱”后剪贴板精确一致，并显示“邮箱已复制”。
- 微信：`shsz1610`；点击“复制微信号”后剪贴板精确一致，并显示“微信号已复制”。
- 不存在飞书问卷、反馈 WebView、反馈表单或应用内反馈存储。

## 13. 提示卡和技术文案

已删除版本/冻结、教程/步骤、动态帮助、数据健康/安全修复、恢复点、Schema/JSON/checksum、本地路径、报告、图表验收和已删业务等类别的提示。正式 WXML 与页面文案扫描未发现版本、Schema、JSON、Restore Point、当前步骤或教程残留。

## 14. 开发信息与上传包

- Source Map：`uploadWithSourceMap: false`。
- P0 保护：`ignoreDevUnusedFiles: false`。
- `packOptions.ignore` 排除 `docs/`、`scripts/`、`shared-spec/`、`utils/generated/`、README、Git、包管理和常见开发产物。
- Sitemap 只允许首页、学校库、学校详情、帮助和隐私页面；个人数据页面由最后一条 `disallow *` 排除。
- 正式运行不再依赖带发布阶段信息的 generated rules；`releaseStatus`、`productStage`、`featureFreezeVersion`、`performanceBudgetsMs` 等不在运行链或上传包。
- 微信开发者工具 iOS 真机调试构建显示实际代码包为 307 KB；其“代码包”详情弹层未提供可读取的文件明细。
- 按相同运行根目录和 ignore 规则计算的本地未压缩估算：66 个文件、450,592 bytes；最大文件 `utils/rc9-storage.js`，123,459 bytes。该文件数和最大文件是本地估算，不冒充 DevTools 实包分析。
- 本地清单确认不含 docs、scripts、shared-spec、README、测试/报告开发文件或 `.map`。

## 15. 旧数据兼容

继续保持 Storage Schema 5、Backup Format 3、Restore Point Format 2。旧单科、复盘、错题、学习、收藏、对比、学校个人状态、推荐设置和教程字段只保留在迁移、normalizer、Storage/Backup 兼容层和测试夹具中；可导入、校验和恢复，但没有正式页面、路由或 handler。旧收藏不会自动转成目标学校。

## 16. 自动测试

以下均 PASS：

- `node scripts/verify_fcp_mp_first_release.js`：12/12 FCP TEST-ID；
- `node scripts/verify_dual_final_hardening.js`；
- `node scripts/verify_dual_rc1_matching_flows.js`；
- `node scripts/verify_v1_final_ux.js`；
- `node scripts/verify_rc9_full.js`；
- `node scripts/verify_v1_full.js --all-verify`：当前 7 个 release gates；
- `node scripts/smoke_local_logic.js`；
- `node scripts/smoke_page_logic.js`；
- `node scripts/verify_upload_package_ignore.js`；
- 全仓 JavaScript `node --check`；
- `git diff --check`。

数据硬化确认：第 11 个档案、第 101 条成绩、第 101 所目标学校和超过 4 MB 的导入均明确拒绝；原数据保持不变；满额时仍允许编辑已有成绩/目标。

## 17. 开发者工具

- 微信开发者工具 RC 2.02.2607171；基础库 3.7.12；正确项目目录与正式 AppID。
- 最终清空 Console 后执行普通编译成功；Problems 0。
- Console 只有系统初始化信息；人工操作阶段曾出现 DevTools preload、自动热重载和 worker 能力 warning，不是业务异常，最终清空重编译后未保留业务 error。
- 五 Tab、首页、学校库、学校详情、成绩、目标、我的、档案、备份、帮助、隐私均已在模拟器检查。
- 模拟器临时成绩、目标和档案均已清理；没有清空或覆盖用户原有数据。
- 备份页实际生成 1 个档案、1 条成绩、0 所目标学校的本机备份；未发送文件，也未执行覆盖恢复。

## 18. 真机

iOS 真机调试入口已实际生成二维码和 307 KB 调试代码包，但本轮没有可由 Codex 操作的 iPhone 8 Plus，也没有手机端扫码完成连接。当前 FCP 版本的 iPhone 8 Plus 启动、五 Tab、学校、成绩、目标、我的和客服复制烟雾测试未执行；不能沿用 P0 修复版本的历史真机结果冒充本轮证据。未执行体验版上传或审核。

## 19. 正式数据

- 学校：55；2025：103；2026：43；合计：146；超过 740：0。
- AppID：`wxc2a2a94f767438dd`。
- `data/schools.js`：`c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2`。
- `data/admission-scores.js`：`0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88`。
- `data/admission-scores-2026.js`：`3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c`。

## 20. Git

- 分支：`fix/fcp-mp-first-release-consolidation-20260807`。
- 提交信息：`fix: simplify miniprogram for first release fcp`。
- 提交时使用明确文件列表暂存；实际提交 SHA、普通 push 结果和最终工作树状态以最终任务回传为准。
- 未使用 reset、rebase、clean、`git add .`、amend、force push 或 main 直改。

## 21. 剩余 P0

NO

## 22. 剩余 P1

YES

- 当前 FCP 版本尚缺 iPhone 8 Plus 真机烟雾测试；需要用户在手机端扫码或提供同账号前台微信后完成。

## 23. 是否适合进入最终发布前验收

NO
