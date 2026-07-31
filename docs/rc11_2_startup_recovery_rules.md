# RC11-2 启动恢复规则

启动检查 transaction journal、operation lock、restore point temporary、restore temporary 和 cleanupPending。

- clean：正常启动。
- temporary_only：不提交到正式状态，清理尚未验证的恢复点 temporary。
- committed_with_temp_residue：正式数据与 expected 一致，只清临时状态。
- formal_valid_temp_invalid：保留正式数据，清理无效临时数据。
- formal_invalid_temp_valid / both_valid_different / both_invalid：不自动选择或覆盖，返回 `STARTUP_RECOVERY_REQUIRED` 语义供数据管理处理。
- incomplete_lock：超过五分钟且 owner 已无运行操作时清理。

`startupRecoveryVersion=1` 只在本次检查完成后记录。重复启动不会创建恢复点、不会重复导入 legacy 键，也不会让已清除数据复活。
