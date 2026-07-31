# RC11-2 事务状态机

统一阶段：`validate → snapshot → prepare → writeTemporary → verifyTemporary → commit → verifyCommitted → cleanup`。

正式数据只在 commit 阶段改变。validate 至 commit 前失败时清理安全临时状态并保留原数据；verifyCommitted 失败时保留事务日志、恢复点和已写状态，交给下次启动判断；cleanup 失败不回滚已经验证成功的正式数据，而写入 cleanupPending。

操作锁有 owner operationId、operationType、profileId/entityId、global 和 createdAt。全局危险操作阻止普通写入和切换档案；超过五分钟且没有运行操作的锁在启动/下一操作时清理。相同 operationId 的 committed 结果直接复用，不重复副作用。
