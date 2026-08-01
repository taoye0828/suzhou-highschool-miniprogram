# V1 本地事务、幂等、锁与启动恢复规范

## TransactionResult

- `committed`：`ok=true`、`committed=true`、`recoveryRequired=false`。
- `committed_with_warning`：正式数据已经回读确认；只剩 journal/临时文件/锁清理告警，不允许页面提示“原数据保留”。
- `aborted`：提交前失败或已回滚并确认 before 快照；`committed=false`。
- `uncertain`：无法确认 before/after；`committed=null`、`recoveryRequired=true`，必须进入“我的 → 数据管理 → 未完成数据操作”。

页面不能只依赖异常文本判断提交状态；`ok=true` 的 warning 仍是业务成功。

## atomicWrite

阶段为 validate、snapshot、prepare、writeTemporary、verifyTemporary、commit、verifyCommitted、writeCommittedJournal、cleanup、finalReadback。正式值写入并回读后，即使 committed journal 或 cleanup 失败，也返回 committed_with_warning。提交前失败在回滚并回读 before 后返回 aborted；无法确认返回 uncertain。

## atomicRemove

removing journal 保存 `before` 和 `expectedAfter`；清除/最终写入回读通过后改写为 `committed_remove`。journal 删除失败时保留 committed 证据。启动恢复看到 `committed_remove`，或看到带 expectedAfter 且正式数据等于 expectedAfter 的 removing journal，只清理证据，绝不恢复 before。V1-TXN-011 已验证连续两次启动不复活。

## dataRevision

版本化正式状态写入仍由唯一 storage service 在同一事务中写入下一整数。业务成功和 committed_with_warning 只增加一次；aborted、uncertain、cleanup 和同 operationId 重试不重复增加。V1-TXN-012 已覆盖。

## OperationContext 与生产路径

`utils/operation-context.js` 生成 operationId、operationType、profileId、entityId、expectedVersion、startedAt。主要正式页面显式传入；所有公开 mutation service 仍强制兜底生成，已删除 `if (!operationId) return action()` 旁路。

## OperationLock

锁字段包含 lockId、operationId、operationType、profileId、entityId、acquiredAt、expiresAt、ownerSessionId；TTL 为 300000ms。全局危险操作使用 global lock。过期锁仅在 owner operation 不为 running 时清理；过期但仍 running 时返回 STARTUP_RECOVERY_REQUIRED。

## 紧凑 operation state

最多 100 条，每条最多 2048 字节，只保存 operationId、operationType、status、profileId、entityId、resultCode、resultVersion、resultChecksum、restorePointId、startedAt、finishedAt。不保存 result、数组、payload、恢复点正文、导入文件或报告。

## 启动恢复与危险操作恢复点

自动清理已确认 committed journal、cleanup residue 和有效正式数据旁的无效临时数据。formal_invalid_temp_valid、both_valid_different、both_invalid、uncertain 通过数据管理页让用户重试判断、保留正式数据或使用已校验临时数据。

删除档案前使用 full_user_state；清空成绩、目标、阶段目标、任务使用当前档案恢复点；恢复另一恢复点前使用 full_user_state。single_profile 默认不携带或修改共享收藏，已删除档案可以恢复为新档案。

