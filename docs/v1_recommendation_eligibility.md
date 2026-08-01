# V1 历史分差参考成绩资格

考试记录只有同时满足以下条件才可用于历史分差参考：

1. `metricType == full_total`；
2. `totalMaxScore == 740`；
3. `admissionScaleMax == 740`；
4. `eligibilityRuleId` 在产品规则允许列表中；
5. `scoreSchemeSnapshot` 包含完整 ID、名称、指标类型、740 分口径、资格标识和学科规则；
6. `totalScore` 合法且得分率基点与快照一致；
7. 非周测。

周测、单科、部分科目、非 740 分方案、得分率值本身、自动换算值或快照不完整记录均不参与。目标规划、学校库、学校详情、学校对比和历史分差轨迹共用同一资格函数。

验证：`V1-EXAM-004`、`V1-EXAM-005`、`V1-EXAM-008`。
