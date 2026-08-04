# DUAL-RC1 微信小程序同步核查与修复报告

## 1. Git 与保护基线

- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 开始分支：`fix/miniprogram-cross-platform-audit-20260804`
- 开始 HEAD：`ec051a2bcaf104c1fe40cd54caf546d4881207b1`
- 开始时 `origin/main`：`f099c298a127f499ac0aa24d69ccd338ee5c53c2`
- 基线来源：`origin/fix/v1-final-ux-miniprogram-20260804`，同为 `ec051a2`
- 开始工作区：9 个任务内未提交 JS/WXML 修改；逐文件审计后继续，未覆盖未知改动。
- 仓库外备份：
  `/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram_DUAL_RC1_20260805_004500/`
- `utils/backup-restore.js` 补充备份：
  `utils/backup-restore.js.bak_20260805_021500`
- 未执行 reset、clean、rebase、force push、历史改写、删除用户文件或清空本地数据。

## 2. 与 Flutter 对应的四类同步核查

### 2.1 目标学校动态提示

小程序存在对应动态帮助卡和关闭按钮。原关闭状态保存在全局 onboarding 对象中，不按学生
档案隔离；保存失败时页面仍保持隐藏，用户无法知道写入未成功。

修复后关闭状态保存在当前档案 `legacyExtensions.dynamicHelpDismissed` 中，不升级 Schema；点击
后立即隐藏，写入失败会恢复提示并显示“原数据已保留”的本地错误。该写入复用现有操作锁、
事务和幂等保护，不新建第二套数据流。

### 2.2 新增学生档案

小程序没有 Flutter `_dependents.isEmpty` 生命周期问题，但存在相同用户流程的重复触发风险：
连续点击可能重复打开 `wx.showModal`。新增 `creatingProfile` 门控，弹窗完成前后续点击直接返回；
创建失败显示存储错误，成功后刷新并切换新档案。专项测试确认新档案默认 `independent`，旧
`shared` 档案及收藏模式不变。

### 2.3 新手教程第 6、7 步

- 第 6 步不再定位整个目标规划 Tab，而是先切换“目标学校”分段，再定位真实“添加学校”按钮
  `.onboarding-target-school-entry`。
- 第 7 步无成绩时切换“记录”并定位 `.onboarding-score-form`；有成绩时切换“趋势”并定位
  `.onboarding-score-trend`，文案只说明考试名称、日期和总分。
- Overlay 增加 generation token；步骤切换、隐藏和组件销毁都会使旧 selector 回调失效。
- selector 无结果、尺寸无效或目标不在可视区时保持 `highlightVisible=false`，只显示普通说明卡，
  不生成假高亮块。

### 2.4 V1 暂缓单科成绩

正式 WXML 已移除：单科输入、档案学科配置、添加学科、单科趋势、单科统计/分析、成绩详情
单科明细、复盘单科编辑、失分原因学科选择、阶段目标单科输入/展示和任务学科标签。

新成绩和复制的新考试写入 `subjectScores=[]`；新阶段目标写入 `targetSubjects=[]`。编辑旧成绩、
旧模板和旧分值方案时保留隐藏的旧字段；旧单科阶段目标/旧单科方案禁止从 V1 正式入口编辑或
复制，并显示“旧版数据已保留”提示。模型、迁移、Schema 和备份字段仍保留，未做破坏性清理。

## 3. 额外发现并修复的跨端备份阻断

Flutter 当前仍导出 Backup v2，但摘要安全加固后使用 SHA-256；小程序旧格式导入端此前只允许
FNV-1a，导致 Flutter 合法备份被拒绝为“校验摘要算法不受支持”。这是跨端恢复阻断。

小程序现在对旧 Backup v1/v2 按文件声明接受 FNV-1a 或 SHA-256 并验证真实摘要；当前小程序
仍只导出既有 Backup v3/SHA-256。Storage Schema、Backup 格式版本、Restore Point 格式版本和
JSON 结构均未改变。`verify_rc10_cross_platform_backup.js` 已完成双向互解析。

## 4. 修改文件

- `components/onboarding-overlay/onboarding-overlay.js`
- `pages/profile/profile.js`
- `pages/profile-management/profile-management.js`
- `pages/targets/targets.js`
- `pages/targets/targets.wxml`
- `pages/score-trend/score-trend.js`
- `pages/score-trend/score-trend.wxml`
- `pages/exam-settings/exam-settings.js`
- `pages/exam-settings/exam-settings.wxml`
- `pages/home/home.wxml`
- `utils/onboarding.js`
- `utils/rc9-storage.js`
- `utils/backup-restore.js`
- `scripts/verify_dual_rc1_matching_flows.js`
- `docs/miniprogram_cross_platform_audit_report.md`

## 5. 自动验证

- `node scripts/verify_dual_rc1_matching_flows.js`：通过。
- `node scripts/verify_v1_final_ux.js`：通过。
- `node scripts/verify_rc9_full.js`：14 个 RC9 子门禁通过。
- `node scripts/verify_v1_full.js --all-verify`：103 个 TEST-ID 通过；递归排除主脚本后 88 个
  verify 脚本全部通过。
- `node scripts/verify_rc10_cross_platform_backup.js /Users/tom/Dev/suzhou_highschool_app`：通过。
- `node scripts/smoke_local_logic.js`：通过。
- `node scripts/smoke_page_logic.js`：通过。
- 全仓 `node --check`：通过。
- `git diff --check`：通过。

故障注入测试中出现的 `[storage] ... failed Error` 是测试主动模拟本地写入/删除失败，相关用例
均验证了“原数据保留”并通过，不是未处理的运行错误。

## 6. 微信开发者工具与 external_manual_acceptance

- 工具：微信开发者工具 RC `2.02.2607171`。
- 项目路径：`/Users/tom/Dev/suzhou_highschool_miniprogram`。
- 工具界面识别到正式名称“苏程记录”、五个 Tab 和 `pages/home/home`。
- 已触发“普通编译”，随后工具弹出：
  `INVALID_LOGIN, access_token expired [20260805 01:27:48]`。
- 因登录会话过期，本轮不能确认 Problems/Console 清零，也不能完成成绩、目标规划、我的页面的
  真实点击验收。
- 设备预览、真机、体验版上传、提交审核均未执行。

external_manual_acceptance：用户重新登录微信开发者工具后，需要重新普通编译，确认 Problems
和 Console 无错误，再依次验收新增档案连点、动态提示关闭/失败恢复、教程第 6/7 步、总分 0/740、
旧数据仍存在且正式页无单科入口。不得用当前 Node PASS 代替这些平台步骤。

## 7. 正式数据与安全保护

- 学校：55；`data/schools.js` SHA-256
  `c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2`。
- 分数线：146（2025=103、2026=43）；`data/admission-scores.js` SHA-256
  `0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88`。
- 2026 来源文件 SHA-256：
  `3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c`。
- 满分：740；AppID：`wxc2a2a94f767438dd`。
- Storage Schema=5、Backup=3、Restore Point=2，版本均未变化。
- 跨端一致性：学校/分数投影哈希一致，无重复 ID、无无效引用、无超过 740 的记录。
- 运行代码扫描无 `wx.request`、`wx.uploadFile`、`wx.login`、云函数、硬编码 Token、密码或密钥。
- 未新增登录、后台、网络、AI、支付、广告、定位、地图或敏感权限。

## 8. 回滚

优先使用 Git 对本提交做普通反向提交；不要 reset 或覆盖历史。提交前的逐文件副本在上述
仓库外备份目录中，额外备份的 `backup-restore.js` 可用于单文件比对。回滚单科 UI 时仍不得删除
用户旧 `subjectScores`、`targetSubjects`、模板或分值方案数据。

## 9. 剩余风险

1. 微信开发者工具登录过期，平台编译结果、Problems/Console 和关键页面人工点击尚未完成。
2. 预览、真机、体验版上传和审核未执行。
3. 旧版单科字段继续保留在底层兼容层，未来重新开放功能时必须基于现有字段做版本化设计，不能
   另建冲突字段或静默迁移清空。

在自动验证和 Codex 可执行验证范围内，零已知 P0/P1；平台人工验收仍受登录过期阻断。
