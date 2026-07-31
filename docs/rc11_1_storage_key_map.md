# RC11-1 小程序存储键地图

正式页面不直接调用微信存储 API；唯一 Storage adapter 为 `utils/rc9-storage.js`，公开入口为 `utils/storage.js`。档案隔离由 `rc9.profile_data.v4[profileId]` 完成，页面不拼接键。

| 键名 | 用途 | 读者 | 写者 | 所属档案 | 备份 | 清除 | 迁移/旧键 | 决定 |
|---|---|---|---|---|---|---|---|---|
| `rc9.storage_schema_version` | schema 版本 | storage/migration | storage | 全局 | 摘要 | 全部清除后重建 | 当前 | 保留 |
| `rc9.student_profiles.v4` | 档案列表 | storage, backup, health | storage | 全局 | 是 | 全部 | v4 | 保留 |
| `rc9.active_profile_id.v4` | 唯一 activeProfile | storage | storage | 全局 | 是 | 全部 | v4 | 保留 |
| `rc9.profile_data.v4` | 收藏、目标、成绩、复盘、原因、任务、阶段目标、设置与历史的唯一档案容器 | 所有正式中心经 storage | storage 原子事务 | `profileId` | 是且只导出一次 | 当前档案/全部 | v4 | 保留 |
| `rc9.shared_favorite_school_ids.v4` | 共享收藏 | storage | storage | 全局共享 | 是 | 全部 | v4 | 保留 |
| `rc9.onboarding.v4` | 教程状态 | onboarding | storage | 全局 | 是 | 全部 | v4 | 保留 |
| `rc9.user_settings.v4` | 用户设置 | storage/backup | storage | 全局 | 是 | 全部 | v4 | 保留 |
| `rc9.migration_backup.v4` | 迁移前快照 | migration/health | storage migration | 全局临时安全数据 | 否 | 全部 | migration-only | 保留 |
| `rc9.last_migration.v4` | 最近迁移记录 | storage | migration | 全局 | 否 | 全部 | migration-only | 保留 |
| `rc9.data_revision.v4` | 页面刷新版本 | 页面/health | storage | 全局 | 否 | 全部 | 当前 | 保留 |
| `rc9.clear_marker.v4` | 清除防复活 | migration/health | clearLocalData | 全局 | 否 | 清除时重写 | 当前 | 保留 |
| `rc9.import_snapshot.v4` | 导入前快照 | backup/health | backup | 全局临时安全数据 | 否 | 全部 | 当前 | 保留 |
| `rc10.transaction_journal.v1` | 原子写事务日志 | storage/health | storage | 全局临时 | 否 | 成功立即清理/全部 | 当前 | 保留 |
| `rc10.repair_snapshot.v1` | 修复前快照 | health | health | 全局临时 | 否 | 全部 | 当前 | 保留 |

## migration-only 旧键

以下字符串只定义在 `utils/legacy/migration/storage-keys.js`，仅由 `utils/storage-migration.js` 读取，或由全部清除统一移除：`mp1.favorite_school_ids`、`mp1.target_records`、`mp1.target_draft`、`rc8.learning_target_records.v1`、`mp1.score_records`、`mp1.exam_year`、`rc8.onboarding.v1`。

RC11-1 已删除正式服务对旧键的回退读写。迁移失败时旧值原样保留，但正式页面返回安全错误/空状态；迁移完成后不会读取旧键，清除后也不会复活。
