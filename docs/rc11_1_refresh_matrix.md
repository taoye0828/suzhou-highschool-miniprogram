# RC11-1 小程序即时刷新矩阵

小程序没有跨页常驻 Widget 缓存；正式写入统一增加 `rc9.data_revision.v4`，五个 Tab 和所有二级业务页在 `onShow` 读取 activeProfile 与正式容器。不依赖强制重启。

| 操作 | 消费者 | 当前刷新机制 | 同步/重新进入 | 旧缓存 | RC11-1 测试 |
|---|---|---|---|---|---|
| 新增成绩 | 成绩列表、趋势、首页、推荐、目标分差、阶段目标当前分、学科分析 | 当前页 `loadRecords`；其他页 `onShow/loadAll` | 当前页同步，切换 Tab 即刷新 | 无 profile 缓存 | first-use + refresh matrix |
| 编辑成绩 | 同上 | 同上 | 同上 | 无 | second-exam |
| 删除成绩 | 同上；review/reason 删除；独立 task 保留 | `deleteScoreRecord` 原子更新；页面 `onShow` | 同步 | task 来源安全降级 | second-exam |
| 收藏学校 | 学校卡片、详情、对比、收藏筛选、我的收藏 | 写入后当前页 refresh；其他页 `onShow` | 同步/切页 | 无 | first-use + refresh matrix |
| 加入目标 | 学校卡片、详情、目标规划、首页、目标筛选、对比 | 写入后 current refresh；其他页 `onShow` | 同步/切页 | 无 | first-use |
| 切换档案 | 五 Tab、设置、最近浏览、主要目标 | `activeProfileId` 原子切换；各页 `onShow` 重新读 | 切页即刷新 | 成绩页检测 activeProfileId 并重置编辑态 | multi-profile |
| 清除数据 | 五 Tab、教程状态、迁移标记、旧键、临时键 | 原子 remove + clearMarker + 空 v4 初始化 | 返回/切页即刷新 | 旧键已删除且 ignoreLegacy | storage keys + clear data |
