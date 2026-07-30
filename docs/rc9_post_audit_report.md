# RC9 实码复核与 RC10 处理决定

## 基线

- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 审计开始 HEAD / 本地 `origin/main`：`14edfd490ab3b2607d4a242dcf58ffc67a8be3c9`
- 分支：`main`
- 开始工作区：干净、无 staged、无未跟踪文件、无 `.git/index.lock`
- 远程 fetch 本轮首次连接超时；本地 remote-tracking SHA 与已确认安全 SHA 一致。

## 已确认完成

- 五个主导航真实为：首页、学校库、成绩、目标规划、我的。
- `pages/score-trend` 是成绩记录、趋势、学科和复盘的正式入口。
- `pages/targets` 是推荐、目标学校和阶段学习目标的正式入口。
- `pages/target-analysis` 已是轻量转发，不保存第二套业务数据。
- 收藏、目标学校、成绩均由 `utils/rc9-storage.js` 的 v4 档案数据统一读写。
- 目标记录为 `schoolId + schoolName + level`，按 schoolId 去重。
- 多学生档案通过 `profileData[profileId]` 隔离；独立/共享收藏为显式模式。
- v1 → v2 → v3 → v4 迁移实际在 `app.js` 启动时执行，具备迁移前快照、幂等与清除标记。
- 备份恢复有真实页面入口，支持校验、预览、合并、覆盖和导入前快照。
- 成绩趋势排序为 examDate、createdAt、id；取最新 10 条后升序绘制。
- 点、成绩、考试名称、日期使用同一 `point.x`，单条记录居中。

## 部分完成

- RC9 复盘仍主要内嵌在考试记录，缺少独立复盘和按学科失分原因实体。
- 最近历史只有最近浏览学校，缺少筛选、对比、考试、目标、档案和分段记录。
- 学校详情有历年列表，但缺少明确的逐项目趋势结构和阶段/中考情景分差。
- 学校对比只支持最多三校，没有顺序调整，且一所学校也会进入“可对比”状态。
- 备份为 RC9 嵌套 `payload` 格式，尚未使用双端统一的 RC10 顶层字段。
- 原子写入只做逐键写入失败回滚，没有事务日志、逐键回读校验和启动恢复。

## 未完成

- 三档个人成绩情景规划。
- 独立失分原因分类、统计与从复盘创建学习任务。
- 学习任务与阶段目标两层进度中心。
- 完整本地数据健康检查、安全修复和修复前快照恢复。
- 55 所学校数据质量矩阵。
- 动态状态帮助和 2027 年度候选数据维护阻断工具。

## 重复实现

- `utils/storage.js` 保留约 400 行旧存储实现，文件末尾才以 `module.exports = RC9_STORAGE` 覆盖导出。运行时虽然只暴露 RC9 服务，但旧函数形成可漂移的第二套实现。
- RC10 已将该文件收口为单行版本化存储入口；旧键与转换规则只保留在 `utils/storage-migration.js`。

## 兼容文件

- `pages/target-analysis/*`：保留旧路径兼容，只执行到目标规划推荐分段的 `switchTab/reLaunch`，无推荐、筛选或存储逻辑。
- `utils/storage-migration.js`：仅保留旧模型/旧键到 v4 的纯迁移转换，正式页面不直接调用旧业务函数。

## 删除、转发与保留清单

- 删除文件：0。
- 转发页面：1 组，`pages/target-analysis/*`。
- 仅迁移保留：`utils/storage-migration.js` 与 `rc9-storage.js` 内的 legacy normalizer。
- 旧重复实现：`utils/storage.js` 已替换为唯一入口。

## RC10 处理决定

- 保持 `storageSchemaVersion = 4`，在同一档案容器扩展复盘、失分原因、学习任务、情景设置和最近历史，避免无必要的 schema 大迁移。
- 备份格式提升到 `backupFormatVersion = 2`、`appDataVersion = rc10`，继续接受 RC9 v1 备份。
- 所有用户数据写入经事务日志、旧值快照、逐键回读校验、失败回滚和启动恢复。
- 正式学校、分数线、schoolId、scoreId 与来源 URL 不进入用户备份，也不由数据修复修改。
