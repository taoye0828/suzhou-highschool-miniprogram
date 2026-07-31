# 【RC11-2 双端恢复点、故障注入与本地数据稳定性完整执行报告】

## 一、开始状态

- 小程序开始 `HEAD = origin/main = 98c6f5ea749faa2c2460f026ed1443ebe8ff647a`，`ahead/behind = 0/0`，分支 `main`，工作区、暂存区和未跟踪文件均为空，无 `.git/index.lock`。
- Flutter 开始 `HEAD = origin/main = 1da6c96f1e580561513af669f5c538bf3c317806`，`ahead/behind = 0/0`，分支 `main`，工作区、暂存区和未跟踪文件均为空，无 `.git/index.lock`。
- 并发检查只发现普通微信开发者工具、Flutter/Dart daemon 等常驻进程，没有另一个任务持续写入任一仓库。

## 二、仓库外备份

- 小程序：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC11_2_STABILITY_20260731_224456`，`backup_manifest.txt` 245 条。
- Flutter：`/Users/tom/WorkData/05_Backups/suzhou_highschool_app/RC11_2_STABILITY_20260731_224456`，`backup_manifest.txt` 380 条。
- 两个目录均包含开始 Git 状态、架构/测试/路由清单、正式数据哈希、完整 `repository/` 和逐文件 `modified_file_backups/`；本轮后续修复的历史测试和页面也先追加了 `.bak_20260731_224456`。
- 开始与结束原始 SHA-256：`data/schools.js = c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2`；2025 文件 `0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88`；2026 文件 `3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c`。

## 三、现有架构审计

- 正式页面只经 `utils/storage.js → utils/rc9-storage.js`；正式状态仍是 Schema v4 的 `profiles + activeProfileId + profileData + sharedFavorites + onboarding + userSettings`。
- 事务入口为 `atomicWrite`、`atomicRemove`、`updateVersionedState`；统一阶段为 `validate → snapshot → prepare → writeTemporary → verifyTemporary → commit → verifyCommitted → cleanup`。
- 原有临时区为 `rc10.transaction_journal.v1`、`rc9.import_snapshot.v4`、`rc9.migration_backup.v4`、`rc10.repair_snapshot.v1`。
- RC11-2 临时/控制区为 `rc11.restore_point_index.v1`、`rc11.restore_point_payloads.v1`、`rc11.restore_point_temporary.v1`、`rc11.restore_point_operation_state.v1`、`rc11.operation_lock.v1`、`rc11.restore_temporary.v1`、`rc11.cleanup_pending.v1`、`rc11.startup_recovery.v1`。
- `app.js` 先执行 `ensureStorageMigrated`，再执行 `recoverStartupState`。`utils/rc11-stability.js` 只是正式服务的纯模型/checksum 依赖，不是第二套事务服务、仓库、迁移入口或页面恢复算法。

## 四、恢复点模型和校验

- `restorePointFormatVersion = 1`，`storageSchemaVersion = 4`，`backupFormatVersion = 2`；恢复点容器与跨端备份版本、checksum 彼此独立。
- 顶层字段为 `id/reason/createdAt/profileScope/restorePointFormatVersion/storageSchemaVersion/backupFormatVersion/appDataVersion/sourcePlatform/summary/checksumAlgorithm/payload/metadata/checksum`。
- reason：`before_migration`、`before_import`、`before_data_repair`、`before_clear_profile`、`before_clear_all`、`before_bulk_edit`、`before_restore`、`manual`。
- scope：`single_profile`、`all_profiles`、`full_user_state`；摘要为档案、成绩、收藏、目标学校、阶段目标、学习任务、复盘数量。
- payload 只允许 `profiles/activeProfileId/profileData/sharedFavoriteSchoolIds/onboarding/userSettings` 的相应范围，不含学校、分数线、AppID、代码、密钥或缓存。
- canonical JSON 对对象 key 词典排序、保持数组顺序和 null、UTF-8 编码，计算 SHA-256 时只排除 `checksum` 自身。双端固定夹具 checksum：`72fbf5651a6b76a7d51c93e0a0f6296e809c77d3bc0486d2dac9a4f903db6109`。

## 五、创建、上限和危险操作

- `createRestorePoint` 从正式状态按 scope 取快照，生成摘要/checksum，写 `restorePointTemporary`，回读并验证，再事务提交 index/payload、提交后回读，最后清 temporary。
- 创建失败统一返回“未能创建安全恢复点，本次操作未执行”，后续导入、修复或清除不执行，原正式数据不变。
- 最多保存 10 个；第 11 个成功提交后按 `createdAt + id` 稳定删除最旧项。新恢复点先成功，才执行超限淘汰。
- `clearCurrentProfileData`、`clearLocalData`、备份合并/覆盖导入、数据修复和恢复均已接入自动安全点；对应 reason 分别为 `before_clear_profile/before_clear_all/before_import/before_data_repair/before_restore`。迁移/批量编辑规范保留 `before_migration/before_bulk_edit`。
- 历史 remove-failure 回归发现“已失败 owner 的锁清理失败后阻止下一次重试”；`acquireOperationLock` 现先核对 operation state，只回收已结束 owner 或失效锁，真实 running owner 仍不可覆盖。

## 六、恢复语义

- 正式入口 `restoreFromRestorePoint` 先 `getRestorePoint` 校验 format/scope/checksum/summary，再创建完整当前状态 `before_restore`，随后构建 `restoreTemporary`。
- `_validateRestorePayload` 等价校验档案/activeProfile、成绩 0–740、重复 ID、profileId 归属和学校引用；通过后才切换正式状态并回读验证。
- 失败时恢复调用前状态，保留 before_restore，返回“恢复未完成，当前数据已保留”；成功后无重复 ID。
- `single_profile` 只替换目标 profile/profileData；其他档案、activeProfile 和非共享收藏不变。共享收藏按档案现有 `favoritesMode` 处理。`all_profiles` 恢复全部档案/activeProfile/档案级数据但保留全局设置；`full_user_state` 还恢复 onboarding 和 userSettings。

## 七、故障注入

- 注入器只通过测试参数传入 `atomicWrite/createRestorePoint/restoreFromRestorePoint`，不读持久化调试开关，正式页面和 Release UI 无入口。
- validate、snapshot、prepare、writeTemporary、verifyTemporary 失败：操作失败、正式数据不变、安全清理临时状态。
- commit 失败：按 previous/旧快照回写，正式数据保持原状态。
- verifyCommitted 失败：不宣称安全，不删除 committed journal/恢复点，交给启动判断。
- cleanup 失败：不回滚已验证提交，写 `cleanupPending`，下次启动清理。8 个阶段均有真实专项测试。

## 八、幂等与操作锁

- operation context 包含 `operationId/operationType/profileId/entityId/expectedVersion/startedAt/status`；相同 operationId 的 running 返回进行中，committed 直接复用原结果，副作用不重复。
- 恢复、导入、修复、清除全部和迁移使用全局锁；档案清除使用档案范围；实体编辑使用实体范围。锁记录 owner 和 createdAt，正常完成释放；owner 已结束或超过 5 分钟才可回收。
- 新增/删除成绩、任务、目标、导入、恢复等重复操作均有服务层测试；目标学校继续以 `profileId + schoolId` 防重复。统一锁顺序避免嵌套反向获取造成死锁。

## 九、版本冲突

- 成绩、复盘、失分原因、学习任务、阶段目标、目标学校用户状态和学生档案均有 `version`，旧数据缺失时为 1，成功修改后加 1。
- 页面保存携带 `expectedVersion`；与当前正式 version 不一致返回 `VERSION_CONFLICT`，用户提示“这条内容已在其他页面更新，请重新载入后再修改”，不自动覆盖或合并文字。
- 专项测试覆盖成绩、复盘、任务、阶段目标、档案和目标学校：旧 version 失败且新数据保留，重新加载当前 version 后可成功写入下一版本。

## 十、启动恢复

- `recoverStartupState` 检查 transaction journal、operation lock、restore point temporary、restore temporary 与 cleanupPending，并记录 `startupRecoveryVersion = 1`。
- 已验证：clean、temporary_only、committed_with_temp_residue、formal_valid_temp_invalid、formal_invalid_temp_valid、both_valid_different、both_invalid、incomplete_lock/失效锁和 cleanupPending 语义。
- 正式有效时不被无效 temporary 覆盖；两份有效但不同、正式无效/临时有效或两份均无效时不自动选择，保留材料并返回需数据管理处理的语义。重复启动幂等，不重复生成恢复点、实体或 legacy 数据。

## 十一、多档案

- 固定测试使用默认档案 650/目标 A/任务 A 与第二档案 610/目标 B/任务 B。恢复默认档案后只有默认档案回到恢复点，第二档案值、目标和任务不变，无串档或重复。
- all_profiles/full_user_state 测试确认 profileId 保持、activeProfile 合法；共享收藏仅在现有共享模式下跟随对应 scope。

## 十二、UI 与人工检查

- 正式入口：`我的 → 数据管理 → 恢复点`；页面为 `pages/restore-points/restore-points`，只调用 `listRestorePoints/createRestorePoint/restoreFromRestorePoint/deleteRestorePoint/clearRestorePoints`，不直接读写 storage key 或计算 checksum。
- 页面具有 loading/empty/busy/error 状态，显示时间、原因、档案范围/名称、摘要和版本；恢复、单删和清空有确认，busy 防重复点击。
- 微信开发者工具 RC `2.02.2607171` 已在真实路径执行普通编译；标题“苏程记录”、五 Tab、Problems 0。实际进入恢复点页，验证空状态、手动创建、摘要、恢复确认和删除确认；最终恢复/删除动作均取消，保留模拟器数据。
- 本次界面尺寸只确认 iPhone 12/13 (Pro)。320/375/390/414/430、iPad、大字体、失败注入提示、真机预览未完成；未扫码、未上传体验版、未提交审核。

## 十三、小程序验证

- 新增 15 个脚本：`verify_rc11_2_storage_architecture/model/checksum/creation/limits/execution/fault_injection/idempotency/operation_locks/version_conflicts/startup_recovery/profile_restore_isolation/restore_point_ui/cross_platform_consistency/full.js`，每个均单独执行通过。
- 最终历史回归按实际 79 个 `verify_*.js`/`smoke_*.js` 执行：79/79 通过，包含 RC11-1、RC10、RC9、RC8、RC7、RC6、MP、740、2026、上传包、迁移、备份、多档案和双端一致性。
- 另外 5 个 JS 是带参数的数据工具、生成器或 harness，不作为无参数测试运行；它们与全部运行 JS 一起通过 `node --check`。`app.json`、`project.config.json`、两份 RC11-2 JSON 文档解析通过，`git diff --check` 通过。
- 失败修复实录：最初 6 个历史门禁失败；修正恢复点页清单、公开文案扫描的内部 `commit` 误报、恢复点失败提示和已结束锁回收后，6/6 及 79/79 全部通过。

## 十四、Flutter 验证（配对仓库）

- 15 个 RC11-2 测试文件逐项 15/15 通过；格式检查 131 文件、0 改动；`flutter analyze` 为 `No issues found!`。
- 首次全量回归发现目标分析页同时触发三次本地事务写入；改为依次 await 保存草稿、推荐设置和情景设置后，定向页面/锁/full 测试通过，最终 `flutter test` 231 项全部通过。
- `flutter build ios --no-codesign` 成功，Xcode 18.0 秒，Runner.app 报告 18.3 MB（磁盘约 18 MB）；未签名，不等于真机/TestFlight/App Store。
- `flutter build web` 成功，编译 14.1 秒，`build/web` 磁盘约 42 MB；Flutter 模拟器和真机视觉验收未执行。

## 十五、正式数据与产品边界

- 学校 55；2025 年 103；2026 年 43；总计 146；满分 740；学校 ID、scoreId 和来源引用有效且未修改。
- 双端字段内容 hash：school `a1c8c18d9364ddb30c80db61d728f78ab50d00ea2c36f7ccc405d68adc97e5be`，score `ceba74cbebd620ef385091a6d734604cd4ffc939da4cdd2f25130460d9b945e9`；跨端数据/隐私 16/16、Flutter runtime 6/6。
- 小程序名仍为“苏程记录”，AppID 仍为 `wx17e903f81714736f`，五个主导航不变；没有正式 2027 数据。
- 未新增登录、后台、云、Supabase、AI、网络业务推荐、用户上传、支付、广告、定位、推送或统计 SDK。

## 十六、文档和 Git

- 文档：本报告、`rc11_2_existing_storage_architecture.md`、机器规范 JSON、事务状态机、故障注入矩阵、版本冲突规则、启动恢复规则和固定夹具；README 已说明触发场景、10 个上限、失败保护、scope、事务、冲突、启动恢复和人工边界。
- 小程序功能/测试/修复提交：`29efef7 feat: add miniprogram RC11-2 restore safety`、`f5fd5a6 test: validate miniprogram RC11-2 stability`、`1060a70 fix: keep miniprogram RC11-2 retries safe`。文档提交为包含本报告的后续提交。
- Flutter 功能/测试/修复提交：`556c44d feat: add Flutter RC11-2 restore safety`、`54224ab test: validate Flutter RC11-2 stability`、`6bbc203 fix: serialize Flutter local analysis writes`。文档提交为包含配对报告的后续提交。
- 由于 Git 提交不能在自身内容中预知自己的 SHA，本报告列出全部前置提交；最终文档提交 SHA、普通 push 后的 `HEAD/origin/main`、ahead/behind、工作区、未跟踪文件和 index.lock 以本轮最终交付的实际 Git 核验为准。

## 十七、结论、未完成项和回滚

- 代码、自动测试、构建、数据不变量和小程序本地编译/恢复点主路径通过；未建立第二套事务或恢复服务，RC11-2 本地稳定性目标通过。
- 未完成：小程序多尺寸/真机/预览/体验版/审核；Flutter 模拟器/真机、大字体/iPad、签名、Archive、TestFlight/App Store。原因是这些需要平台设备、账号或发布动作，自动测试与无签名构建不能替代。
- 剩余风险：SharedPreferences/微信真机存储配额和系统级中断仍需真机故障演练；both_valid_different 等保守启动状态仍需完整人工选择流程验收；恢复点最多 10 个但极大用户 payload 的设备占用仍需真实数据量观察。
- 下一轮建议：先完成双端小屏/大字体/真机恢复演练，再决定是否上传体验版；不要在平台人工验收前继续扩大本地存储功能。
- 安全回滚：优先 `git revert <本轮提交 SHA>`；需要逐文件取回开始状态时使用上述仓库外 `repository/` 或 `.bak_20260731_224456`。禁止 reset/clean/rebase/force push。
