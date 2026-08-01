# PRELAUNCH-FINAL-MP 用户路径验收

## 结论

- 自动逻辑/页面契约：16 组通过。
- 开发者工具完整点击路径：0 组完成；账号权限阻止模拟器创建。
- 不能用自动契约代替最终五 Tab、页面状态与真实交互验收。

| 路径组 | 自动证据 | 开发者工具结果 |
| --- | --- | --- |
| 首页首次/有数据状态 | V1 UI、RC11-1 first-use | 未运行 |
| 学校完整/部分/别名/空结果/档案搜索 | V1 school-planning、RC9 filters | 未运行 |
| 区域/类型/年份/分数/收藏/目标/标签等筛选 | RC9 school filters | 未运行 |
| 收藏、候选、标签、备注 | V1 school planning、RC9 integration | 未运行 |
| 目标学校、主要目标、取消后保持为空 | V1 school planning、RC9 target | 未运行 |
| 1—3 校对比与第 4 校限制 | RC10 school compare | 未运行 |
| 固定考试、模板、分值方案 | V1 exam suite | 未运行 |
| 得分率、1/2/3/5/9/10/11 条趋势 | V1 trend、RC8 chart | 未运行 |
| 740 资格与情景成绩 | V1 exam、RC9 target | 未运行 |
| 复盘、失分原因、错题、学习任务 | V1 learning、RC10 loss/task | 未运行 |
| 周计划、阶段目标、阶段复盘 | V1 learning、RC9 stage goals | 未运行 |
| 历史分差参考固定区间与每组 5 所 | V1/RC9 target rules | 未运行 |
| 双档案隔离、共享收藏、删除/恢复 | RC11-1 multi-profile、RC11-2 profile restore | 未运行 |
| Backup v3、v2 兼容、导入与恢复点 | V1 backup/recovery、RC11-2 | 未运行 |
| 四类 text/JSON 报告与 FakeFileShareAdapter | V1 report/export | 未运行真实分享 |
| 12 类启动恢复状态 | RC11-2 full | 仅隔离测试，未对真实 Storage 注入故障 |

由于 P5 写入前安全门禁未能建立模拟器恢复点、Backup v3 和 checksum，本轮没有创建“上架验收A/B”，也没有在未知真实 Storage 中写入临时验收数据。
