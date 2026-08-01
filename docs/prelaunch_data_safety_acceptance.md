# PRELAUNCH-FINAL-MP 数据安全验收

## 写入前门禁结果

- 开发者工具未能创建正式 AppID 模拟器。
- 未读取或修改当前模拟器业务 Storage。
- 未假设任何现有数据是测试数据。
- 未创建 `before_prelaunch_acceptance` 恢复点。
- 未导出真实模拟器 Backup v3。
- 未计算真实模拟器测试前/后用户状态 checksum。
- 未创建“上架验收A/B”、固定考试、目标、报告或其他临时数据。
- 未清除模拟器数据，也未做破坏性故障注入。

因此 `beforeAcceptanceChecksum`、`afterAcceptanceChecksum`、`testDataRestorePointId` 和 `testDataBackupPath` 均保持空值；不能声称 `restoredExactly=true`。这表示写入保护门禁正确阻止了未经备份的数据验收，不表示真实恢复路径已经在本机模拟器验收。

## 已通过的隔离自动测试

- MemoryStorage/FakeFaultInjector 下的事务、锁、幂等、12 类启动恢复、Restore Point v1/v2、Backup v2/v3、档案隔离和 checksum 门禁全部通过。
- 正式学校与分数线文件没有修改，raw 与 semantic SHA-256 均与冻结基线一致。

账号权限恢复后，必须先建立完整恢复点、Backup v3 和 before checksum，再执行任何写入型用户路径；完成后必须验证 before/after checksum 完全一致。
