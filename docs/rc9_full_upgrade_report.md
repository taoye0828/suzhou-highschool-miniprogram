# RC9 小程序功能融合与本地数据能力升级报告

## 1. 范围与真实状态

- 项目：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 正式名称：苏程记录
- RC9 版本：`1.9.0`
- 开始 `HEAD`：`ecbeadb3eb5a6c43ae1182dec6886a27dd20c7a3`
- 开始 `origin/main`：`ecbeadb3eb5a6c43ae1182dec6886a27dd20c7a3`
- 开始 ahead：0
- 用户确认的安全提交 `5964b62252cd8694b2dfa88161c622ed50b2a419` 已保留，且包含在开始时已同步的主线中。
- RC9 没有删除文件；提交前统计为 48 个既有文件修改、35 个文件新增、0 个文件删除。

本报告只记录小程序阶段。Flutter RC9 同构升级、双端最终一致性和 Flutter 构建结果在 Flutter 阶段完成后另行记录；此处不提前宣称。

## 2. 备份与回滚

完整仓库外备份：

`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC9_FULL_20260729_214653`

分模块备份：

- 学校库与对比：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC9_SCHOOLS_COMPARE_20260729_221509`
- 成绩中心：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC9_score_trend_20260729_221913`
- 目标规划：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC9_TARGET_CENTER_20260729_221710`
- 主线程集成修正：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC9_INTEGRATION_20260730_111500`

安全回滚优先使用 `git revert <RC9-commit>` 生成可审计的反向提交。也可从上述仓库外备份按文件恢复，再执行 RC9 全量门禁。没有使用 `reset`、`clean`、`rebase`、`stash`、强推或批量覆盖。

## 3. 信息架构与融合结果

原 RC8 五项导航为：首页、学校库、成绩分析、目标规划、我的。RC9 最终五项为：

1. 首页
2. 学校库
3. 成绩
4. 目标规划
5. 我的

主要融合：

- 首页移除旧学校搜索、成绩输入、数据宣传和长说明，改为倒计时、最近考试、最近变化、主要目标、分差、阶段目标及三个快捷操作。
- 成绩记录、总分趋势、学科趋势、确定性个人分析和考试复盘融合到 `pages/score-trend` 的记录/趋势/复盘三个分段。
- 推荐、目标学校、主要目标、差距轨迹和阶段学习目标融合到 `pages/targets` 的推荐/目标学校/学习目标三个分段。
- `pages/target-analysis` 仅保留兼容跳转，不再维护第二套推荐页面或推荐状态。
- 收藏、目标学校、对比选择、最近浏览、成绩、阶段目标均只有一份 RC9 storage 数据。
- “我的”只保留档案、收藏汇总、最近浏览、备份恢复、数据管理、帮助、数据说明、隐私说明和纯本地设置。

## 4. 首页、学校库与学校详情

首页无数据时只显示倒计时和记录成绩/选择目标的引导；有数据时从统一 selector 读取最近考试、成绩变化、主要目标、目标参考分、分差和进行中阶段目标。

学校库支持：

- 名称/别名搜索
- 实际数据中的区域多选
- 实际学校类型多选
- 最新、2026、2025 或全部参考年份
- 参考分下限与上限
- 当前成绩的冲刺/目标/保底匹配
- 只看收藏
- 只看目标学校及目标等级
- 学校名称、参考分升降序和与当前成绩最接近排序
- 逐项清除与重置全部

同一类别多选使用 OR，不同类别和搜索组合使用 AND。无结果时显示条件摘要并提供逐项清除。筛选状态按档案本地保存。

面向用户的住宿未核实、内部审核状态、来源状态和缺失字段状态已从筛选和卡片移除。学校详情只显示有可靠值的正式字段，不补写未知信息。

收藏和目标操作在学校库、学校详情、学校对比、收藏汇总与目标规划之间共享同一数据。对比只保存最多 3 个 `schoolId`，结果实时读取正式学校、参考分和历史分数线。

## 5. 参考分与推荐规则

统一规则位于 `utils/planning.js` 和 `utils/score-analysis.js`：

- 参考分使用不晚于目标年份的最新已收录年份。
- 同校同年多条记录使用最高分。
- 2027 优先 2026；无 2026 时按设置回退 2025。
- 无有效分数线的学校不推荐。
- 默认冲刺：`-30 <= difference < 0`
- 默认目标：`0 <= difference <= 15`
- 默认保底：`difference > 15`
- 默认每类最多 5 所。

RC9 增加地区、类型、2026 限定、2025 回退、只看收藏、排除已有目标、每类数量和自定义差距区间设置；未修改设置时，15 组 RC8 默认推荐兼容场景完全一致。

## 6. 成绩中心、学科与复盘

统一考试记录结构包含 `id`、`examName`、`examDate`、`createdAt`、`updatedAt`、`totalScore`、`subjectScores`、可选班级/年级排名、复盘文本、`profileId` 和 `schemaVersion`。旧 `date/score` 字段继续兼容。

成绩中心支持新增、编辑、删除、清空、复制为新考试、名称搜索和日期筛选。复制只复用名称模板、学科字段和复盘结构，不复制旧成绩或排名。

学科配置默认空，由用户本机配置 `subjectId / subjectName / maxScore / includedInTotal / displayOrder / configVersion`。用户可只填总分、部分学科或全部学科；单科不能超过配置满分，总分不能超过 740。

分析只基于用户自己的记录，使用确定性规则计算最近 10 次、最高、最低、平均、最近变化、最近三次平均、历史平均、波动和连续升降，不与他人比较，不推断录取结果，也不虚构原因。

## 7. 趋势竖直对齐

旧根因不是记录上限 10，而是 Canvas 点位按实际记录数计算、WXML 标签却使用独立固定列宽，两者没有共享坐标。

RC9 保留 RC8 热修复后的唯一 `visibleTrendPoints`：

```text
plotWidth = cssWidth - leftPadding - rightPadding
0 条：无点
1 条：x = leftPadding + plotWidth / 2
2 条及以上：x = leftPadding + index * plotWidth / (recordCount - 1)
```

折线端点、圆点、成绩数字、考试名称和日期都读取同一个 `point.x`。不存在 `width: 10%`、`flex-basis: 10%`、`index / 10`、虚拟空位或十个固定标签。

在 `cssWidth=360`、左右 padding 为 38 时，第一次月考 740、期中考试 740、第二次月考 650 的点、名称和日期 x 都是 `[38, 180, 322]`，逐项误差为 0 CSS px。

320/375/390/414/430 宽度和 DPR 1/2/3 的逻辑坐标测试通过。DPR 专项验证的是 CSS 几何模型，不等于真实 Canvas 渲染或真机视觉验收。

目标学校差距轨迹复用同一真实记录数几何模型。620、635、650、660 对参考分 655 的轨迹为 `-35/-20/-5/+5`。

## 8. 阶段目标、存储迁移与多档案

阶段目标支持名称、开始/截止日期、目标总分、目标学科、每周任务、备注、草稿以及未开始/进行中/已完成/已暂停四种状态。新增考试只更新当前成绩与差距显示，不自动改目标或标记完成。

正式 `storageSchemaVersion` 为 4，迁移链为 `v1 → v2 → v3 → v4`。迁移前保存原始快照；迁移幂等；缺失或损坏项使用安全默认或隔离；未知字段尽量保留；ID 不改写；清除标记阻止旧数据复活。

学生档案包含昵称、目标年份、年级、收藏模式和时间字段，不要求真实姓名。每个档案独立保存成绩、学科、复盘、目标学校、阶段目标、推荐设置、主要目标和目标年份。收藏可明确选择独立或共享；跨档案写入记录会强制改写为当前 `profileId`。

## 9. 备份恢复与清除

备份格式为 `suzhou-highschool-local-backup`，应用数据版本为 `rc9`，摘要算法为 `fnv1a32`。备份包含档案、成绩、学科、复盘、收藏、目标、阶段目标、设置、教程和 schema 版本，不包含正式学校或分数线。

导入检查格式、版本、时间、摘要、必需字段、分数、学科满分、`schoolId`、重复 ID、主要目标归属和跨档案数据。预览后可合并或覆盖；合并时同 ID 取更新时间较新的记录，不同 ID 新增，目标学校按 `schoolId` 去重。导入前生成本地快照，失败不修改现有用户数据。

微信小程序可把 JSON 写入自身本地沙盒，并可从会话文件选择 JSON 导入；微信没有统一接口把任意 JSON 直接保存到系统文件夹。页面如实说明此平台限制，没有伪造跨设备上传能力。

清除当前档案和清除全部数据均二次确认。全部清除原子删除已知键并立即建立空 v4 状态；失败时回滚，旧数据不会在重启后复活。

## 10. 教程、帮助与多设备

保留首次 7 步教程，新增首页、学校筛选、成绩记录、成绩趋势、目标规划、备份恢复和学生档案的按功能重播。教程不创建成绩、收藏或目标；节点不存在时安全跳过。

帮助中心包含分数线来源、推荐边界、本地保存、备份、切换学生、字段隐藏、清除数据和重播教程 8 项 FAQ。

自动几何测试覆盖 320、375、390、414、430 和 DPR 1/2/3；WXML 处理器与标签平衡检查通过。iPad、真实大字体、键盘遮挡和真机安全区域仍属于开发者工具/真机人工视觉验收，未用静态脚本冒充。

## 11. 数据与安全不变量

- 学校：55
- 2025 分数线：103
- 2026 分数线：43
- 总分数线：146
- 成绩上限：740
- AppID：`wx17e903f81714736f`
- `data/schools.js`：`c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2`
- `data/admission-scores.js`：`0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88`
- `data/admission-scores-2026.js`：`3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c`

正式数据、`schoolId`、`scoreId`、来源 URL 和 AppID 均未修改。没有新增登录、后台、云开发、AI、网络推荐、用户数据上传、支付、广告、定位、图片或大型依赖。

## 12. 自动验证结果

以下均已实际运行并通过：

- MP1、MP2、MP4、MP5、MP6
- MP17、MP18 名称同步
- RC6、RC7-1、RC7-FULL、RC8
- 740 上限、2026 数据、上传包忽略
- 本地逻辑 smoke、RC9 更新后的页面逻辑 smoke
- RC8 竖直对齐专项
- 14 个 RC9 专项及 `scripts/verify_rc9_full.js`
- 17 个 WXML 文件的处理器存在性与标签平衡
- 全部运行 JSON 解析
- 全部 JavaScript `node --check`
- `git diff --check` 与 `git diff --cached --check`

`verify_rc9_full.js` 串联 14 个专项，并再次检查名称、`1.9.0`、AppID、数据数量、三份哈希、禁止 API/文案、内部状态 UI 和固定十格逻辑。

## 13. Git 提交

RC8 前置热修复已在开始提交中：

- `ecbeadb` `fix: vertically align score points with exam labels`

RC9 实现提交：

- `66caca9` `feat: add RC9 local migration backup and profiles`
- `a6dd644` `feat: improve RC9 school library filters`
- `e44cab6` `feat: add RC9 score and target planning centers`

验证脚本、README 和本报告使用独立测试文档提交；其最终 SHA 以提交完成后的 `git log` 和总交付报告为准。

## 14. 微信开发者工具与人工验收

开发者工具进程存在，CLI 文件为：

`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`

实际执行 `cli open --project /Users/tom/Dev/suzhou_highschool_miniprogram --lang zh` 后返回：

```text
IDE service port disabled
工具的服务端口已关闭
```

本轮没有输入 `y` 开启端口，没有修改安全设置，没有扫码、预览、上传或提交审核。因此真实状态分别为：

- 自动脚本：通过
- 开发者工具编译：未能通过 CLI 执行
- 人工页面点击：未执行
- 手机预览：未执行
- 体验版上传/审核：未执行

人工验收应覆盖五个 Tab、首页两种状态、学校组合筛选、收藏与对比同步、成绩增删改复制、740/740/650 实际 Canvas、学科与复盘、推荐与目标差距、阶段目标、多档案、备份导入预览、清除不复活、教程，以及 320 至 iPad 尺寸。

## 15. 剩余风险

- 开发者工具服务端口关闭，无法给出 RC9 实际编译、Console、模拟器或真机视觉结论。
- 小程序备份导出文件位于微信本地沙盒；跨设备转移受微信平台文件能力限制。
- 真实 DPR 清晰度、超长学校/考试名、大字体、键盘遮挡和 iPad 交互仍需人工视觉验收。
- Flutter RC9 与最终双端一致性尚待后续阶段完成，不能以当前小程序脚本替代。
