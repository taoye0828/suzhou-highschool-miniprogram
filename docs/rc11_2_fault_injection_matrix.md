# RC11-2 故障注入矩阵

| 阶段 | 正式数据 | 临时状态 | 返回语义 |
| --- | --- | --- | --- |
| validate/snapshot/prepare | 不变 | 无或清理 | 失败 |
| writeTemporary/verifyTemporary | 不变 | 安全清理 | 失败 |
| commit | 原状态回写 | journal 清理 | 失败 |
| verifyCommitted | 不直接判定安全 | 保留 committed journal | 失败并由启动判断 |
| cleanup | 已验证提交保留 | cleanupPending | 成功并带清理警告 |

注入对象只通过测试调用参数传入 `atomicWrite/createRestorePoint/restoreFromRestorePoint`，不读取持久化开关，正式页面无入口。
