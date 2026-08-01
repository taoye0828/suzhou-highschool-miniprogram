# 苏程记录 V1 数据模型

唯一用户数据根仍为 `profileData[profileId]`。Storage Schema v5 在 v4 原字段上增加：`examTemplates`、`scoreSchemes`、`mistakeRecords`、`weeklyPlans`、`stageReviews`、`schoolUserStates`。内置考试模板和内置 740 分值方案只来自 `shared-spec/product_rules_v1.json`，不重复插入每个档案。

每个用户实体保存 `profileId`、`version`、`schemaVersion`、`createdAt`、`updatedAt`。旧考试在迁移时保留 ID、日期、总分、时间和学科成绩，同时补齐 740 分方案快照、`legacy_740_total` 资格标识和得分率基点。安全未知字段只进入受大小限制的 `legacyExtensions`，不保留事务、恢复点 payload、测试或危险对象键。

正式学校数据与用户数据完全分离；学校仍由只读 `data/*.js` 提供，用户学校状态只保存 `schoolId` 引用。
