# V1 分值方案规格

- 内置 `suzhou_admission_740_v1` 只来自产品规则源，不可修改或删除。
- 自定义方案保存在当前 `profileData.scoreSchemes`，支持 `full_total`、`partial_total`、`single_subject`，总满分为 1—740。
- 学科规则为可选；填写时，学科满分合计必须等于方案总满分。
- 保存考试时写入不可变 `scoreSchemeSnapshot`、`totalMaxScore`、`metricType`、`admissionScaleMax` 和 `eligibilityRuleId`。
- 修改或删除当前方案不会改变历史考试。仍被自定义模板引用的方案不允许删除。
- 不同满分记录保留原始分和得分率，不自动换算为 740 分。

验证：`V1-EXAM-003`、`V1-EXAM-004`、`V1-EXAM-007`。
