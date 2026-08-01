# Storage Schema v5 迁移报告

- 迁移链：v1 → v2 → v3 → v4 → v5；已存在 v4 数据只执行 v4 → v5。
- v4 迁移前同时保留原始 `migrationBackup`，并创建 `before_migration` 全用户恢复点。
- 新字段初始化为空数组；内置模板和方案由规则源派生，不写入用户数组，因此重复启动不会重复创建实体。
- 旧成绩补齐 740 分历史方案快照、得分率和资格字段，不改变原 ID、分数、日期或时间。
- 旧 operation state 在迁移写入时压缩为最多 100 条、单条最多 2048 字节，不保留 result/payload。
- dataRevision 在成功迁移时增加 1；Schema 版本键在同一原子提交的最后写入。
- 高于 v5 的存储版本拒绝；迁移失败保留原始键和迁移备份。

自动证据：`V1-MIGRATION-001` 至 `003`，以及更新后的 RC9 migration 回归。
