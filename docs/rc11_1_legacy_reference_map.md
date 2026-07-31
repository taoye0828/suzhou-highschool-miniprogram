# RC11-1 小程序旧兼容引用图

## 分类结果

| 路径 | 原用途 | 路由 | import/测试/迁移/教程/文档引用 | 数据读写 | 深层链接 | 替代页面 | 分类与处理 | 风险与回归 |
|---|---|---|---|---|---|---|---|---|
| `pages/target-analysis/target-analysis.js` | 旧独立成绩推荐页 | `app.json` 仍注册，非 Tab | RC9/RC10/RC11 导航测试；无迁移或教程依赖 | 无 | 可能 | `pages/targets/targets` 推荐分段 | B 类：轻量 `switchTab` 转发，失败才 `reLaunch`，不显示旧业务 UI | 单跳、无循环、无 storage/analyze/save；`verify_rc11_1_navigation.js` |
| `utils/legacy/migration/storage-keys.js` | 旧存储键目录 | 无 | 只被 storage migration/clear 引用 | 迁移读取，清除移除，不正式写 | 否 | `rc9.profile_data.v4` 等正式键 | C 类：migration-only | `verify_rc9_storage_migration.js`、`verify_rc11_1_storage_keys.js` |

## A/B/C/D 汇总

- A 类完全无引用页面：0。审计未发现可安全删除的页面文件，因此没有为追求数量删除有效的详情、收藏、对比、备份、帮助或数据管理二级页。
- B 类转发：1 组（target-analysis 四个页面资源）；保留深层链接兼容，不读写旧数据。
- C 类迁移：1 组；旧键字符串已集中到 migration 目录，正式服务的回退读写已删除。
- D 类旧测试：8 个历史脚本已迁移为先初始化正式 v4 或显式验证 migration-only 行为，不再通过向旧键写入来模拟正式运行。
