# V1 得分率与趋势规格

`scoreRateBasisPoints = Math.round(totalScore * 10000 / totalMaxScore)`。存储使用整数基点，页面以两位小数百分比展示。

- 总分趋势可切换原始分与得分率，两种指标使用同一稳定排序和同一 x 坐标。
- 学科趋势可切换原始分与得分率；得分率必须使用每条历史记录中的学科 `maxScore`，不使用当前配置覆盖旧满分。
- 只有 1 条时居中，2 条以上共用 `leftPadding + index * plotWidth / (count - 1)`，最多显示最近 10 条。

验证：`V1-TREND-001`、`V1-TREND-002`、`V1-TREND-003`。
