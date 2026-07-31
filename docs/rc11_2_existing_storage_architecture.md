# RC11-2 小程序现有存储架构审计

正式页面继续通过 `utils/storage.js` 进入 `utils/rc9-storage.js`。正式状态是 Schema v4 的 `profiles + activeProfileId + profileData + sharedFavorites + onboarding + userSettings`；页面不直接读写这些键。

- 正式事务入口：`atomicWrite`、`atomicRemove`、`updateVersionedState`。
- 事务阶段：validate、snapshot、prepare、writeTemporary、verifyTemporary、commit、verifyCommitted、cleanup。
- 原有临时状态：`rc10.transaction_journal.v1`、`rc9.import_snapshot.v4`、`rc9.migration_backup.v4`、`rc10.repair_snapshot.v1`。
- RC11-2 扩展：`restorePointIndex`、`restorePointPayloads`、`restorePointTemporary`、`restoreTemporary`、`operationLock`、`cleanupPending` 和 `startupRecovery`。
- 备份：`utils/backup-restore.js` 的 v2 跨端备份仍保留 FNV-1a32；恢复点容器独立使用 SHA-256，不复用备份 checksum。
- 清除：`clearCurrentProfileData` 与 `clearLocalData` 先调用正式恢复点入口；清除全部保留恢复点区域。
- 启动：`app.js` 先 `ensureStorageMigrated`，再 `recoverStartupState`。
- 多档案：仍以 `profileData[profileId]` 隔离；单档案恢复只替换对应 profile 与 profileData。

`utils/rc11-stability.js` 是 `rc9-storage.js` 的纯模型/checksum 组件，不是第二套仓库、事务入口或页面旁路。RC11-2 没有创建第二套正式数据服务、恢复算法或迁移入口。
