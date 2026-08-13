# 当前正式候选门禁

当前正式产品冻结基线是：10 个页面、5 个 Tab、55 所学校、146 条历史分数线、740 分上限，以及用户数据完全保存在本机。

统一入口：

```bash
node scripts/verify_production_release_candidate.js
```

该入口包含 35 个与当前正式产品一致的门禁，覆盖 FCP 页面冻结、数据完整性、Storage 迁移、备份恢复、故障注入、事务、上传包排除和远程公开数据三层回退。

仓库保留的其他 RC/V1 专项脚本属于历史功能阶段，其中部分会读取已按 FCP 要求删除的对比、收藏、复盘、任务、报告等页面。它们用于历史追溯，不得作为恢复已删除功能的依据。

## 当前现场状态（2026-08-13）

- 本地自动门禁：远程公开数据 29/29、正式候选聚合门禁 35/35、上传包排除和全部跟踪 JavaScript 语法检查已于 2026-08-13 重新运行并通过。
- 微信开发者工具：Problems 为 0，首页、学校库、学校详情、成绩、目标、我的及设置页可使用包内正式数据加载；Storage 中现有 `mp1.*`、`rc9.*`、`rc11.*` 数据仍在。
- 生产门禁未完成：ECS 系统盘没有成功快照，`api.royalcup.top` 尚无可用 DNS/HTTPS/公开接口，微信 request 合法域名尚未配置。
- 因此当前 `PRODUCTION_API_STATUS` 为 `MANUAL_GATE`，`WECHAT_DEVTOOLS_STATUS` 为 `FAIL`；不得上传审核版本、不得关闭 URL 合法域名检查冒充通过，也不得输出 `READY_FOR_USER_FINAL_ACCEPTANCE`。
- 在取得成功快照恢复点前，禁止执行 ECS、DNS、Nginx、HTTPS、公开数据发布或微信合法域名生产写入。
