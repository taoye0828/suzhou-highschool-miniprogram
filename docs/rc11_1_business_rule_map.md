# RC11-1 小程序业务规则地图

| 规则 | 唯一正式文件/函数 | 正式消费者 | RC11-1 处理 |
|---|---|---|---|
| 推荐分类 | `utils/planning.js`：`DEFAULT_LEVEL_RULES`、`classifyDifference`；`difference = userScore - referenceScore`；冲刺 -30..-1、目标 0..15、保底 16+ | `score-analysis`, targets, school presentation | 保持结果 |
| 参考年份 | `utils/planning.js`：`selectLatestReference`、`selectReferenceForSchool` | home, school detail, compare, targets | 只选不晚于目标年份的最新收录年；2027 优先 2026，无则 2025；无有效值返回 null |
| 趋势排序 | `utils/planning.js`：`compareScoreRecords`、`sortScoreRecords` | `utils/score-trend.js`、home、targets | RC11-1 删除 `score-trend.js` 的重复排序实现 |
| 趋势最多十条 | `utils/score-trend.js`：`getVisibleTrendRecords` | 成绩趋势与摘要 | 先全量排序，再取最后 10 条，再升序绘制 |
| 横坐标 | `utils/score-trend.js`：`calculateChartPoints` | 成绩 Canvas、名称和日期标签 | 0 条无点；1 条 `width/2`；多条 `padding + usableWidth*index/(count-1)`；点、成绩、名称、日期共享 `point.x` |
| 目标分差 | `utils/planning.js`：`calculateDifference`、`selectGap`、`formatDifference` | home、school、compare、targets | 正值表示高于历史参考分，负值表示仍差 N 分 |
| 总分上限 | `config/app-config.js`：`EXAM_TOTAL_SCORE=740` | models、planning、score-trend、页面校验、备份校验 | RC11-1 删除趋势文件的重复 740 常量 |
| 学习任务来源失效 | `pages/targets/targets.js`：`presentLearningTask` | 目标规划学习目标 | 来源考试/复盘/原因任一失效时显示“来源记录已删除，任务继续保留” |
