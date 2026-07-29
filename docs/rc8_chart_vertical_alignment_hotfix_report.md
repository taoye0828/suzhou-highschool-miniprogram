# RC8 成绩点与考试名称竖直对齐热修复报告

## 问题与根因

用户发现同一条考试记录的成绩点、成绩数字、考试名称和考试日期没有形成同一条竖直列。旧实现确实存在该问题。

旧实现不是字面上的固定十格，也没有 `index / 10`、`width / 10`、`10%` 或十个固定 WXML 节点。`DEFAULT_LIMIT = 10` 只负责截取最近十条记录，这部分用途正确。

真实根因是点和标签使用了两套互不相干的横坐标：

- `utils/score-trend.js` 中成绩点、折线端点和成绩数字使用当前可见记录数：
  - 一条记录：`x = width / 2`
  - 多条记录：`x = padding + (width - 2 * padding) * index / (recordCount - 1)`
- `pages/score-trend/score-trend.wxml` 将考试名称和日期放在独立的横向滚动容器中。
- `pages/score-trend/score-trend.wxss` 为每条标签固定 `flex: 0 0 128rpx`。
- 因此旧标签中心实际相当于 `(index + 0.5) * 128rpx - scrollLeft`，没有读取 `point.x`，也没有使用 Canvas 的 `38px` 左右绘图区 padding。

三条记录时，点会铺在绘图区左、中、右，标签却只是在标签区左侧连续排三个固定宽度单元。第一列可能偶然接近，第二、三列会越来越左偏。固定十格文件为“无”；造成同类错误的独立固定列宽文件是 `pages/score-trend/score-trend.wxml` 和 `pages/score-trend/score-trend.wxss`。

排序和截取不是根因。旧点与标签来自同一组记录，顺序均为考试日期、创建时间、ID 升序，超过十条后取最新十条并保持升序；同分和同日记录不会合并。

## 修改文件

- `utils/score-trend.js`
- `pages/score-trend/score-trend.js`
- `pages/score-trend/score-trend.wxml`
- `pages/score-trend/score-trend.wxss`
- `scripts/verify_rc8.js`
- `scripts/smoke_page_logic.js`
- `scripts/verify_rc8_chart_vertical_alignment.js`
- `docs/rc8_chart_vertical_alignment_hotfix_report.md`

没有修改正式学校数据、正式分数线、推荐规则、目标规划规则、本地存储结构、底部导航、新手教程、名称、AppID、隐私说明或页面主色。

## 新坐标模型

唯一可见记录集合为 `visibleRecords`：

1. 按 `examDate`（兼容现有 `date`）升序；
2. 同日按 `createdAt` 升序；
3. 创建时间相同时按 `id` 升序；
4. 超过十条时取最新十条；
5. 取完后继续保持升序绘图；
6. `displayIndex` 使用便于展示和验收的 `1..N`，x 计算仍使用内部零基索引。

`visibleTrendPoints` 只由 `visibleRecords` 生成。每个 point 包含：

```text
id, examName, examDate, displayDate, createdAt, score,
sourceIndex, displayIndex, x, y, leftPercent, labelWidth
```

考试名称为空时安全回退为“第 N 次考试”。名称最多显示两行，超长时省略；标签宽度只用于避免首尾完全裁切和控制密度，不改变中心 x。

新横坐标公式：

```text
plotWidth = cssWidth - leftPadding - rightPadding

recordCount = 0: 不生成 point 或标签
recordCount = 1: x = leftPadding + plotWidth / 2
recordCount > 1: x = leftPadding + index * plotWidth / (recordCount - 1)
```

页面左右 padding 均为 `38` CSS px。折线端点、圆点和成绩数字全部直接使用 `point.x`。WXML 不再建立独立 flex/滚动坐标；考试名称和日期直接循环同一组 `visibleTrendPoints`，使用：

```text
leftPercent = point.x / cssWidth * 100
left = leftPercent%
transform = translateX(-50%)
```

Canvas 与标签层都为父容器的 `width: 100%`，标签层没有额外横向 padding。因此成绩数字、点、名称和日期共享同一个 x。

## Canvas、DPR、容器与重绘

当前页面使用旧式 `wx.createCanvasContext`，不是 Canvas 2D node。旧代码没有 `scale()`、重复 transform 或把 x 再乘 DPR 的行为，DPR 不是本次错位根因，因此没有扩大为 Canvas API 重写。

逻辑级 DPR 模型分别使用 `backingWidth = cssWidth * dpr`，而几何函数始终只接收实际 CSS 宽度。DPR 1、2、3 下 point、名称和日期的逻辑 x 完全相同。这证明坐标模型不把 backing store 或 DPR 混入 CSS x；它不是实际 Canvas DPR 渲染测试。旧式 Canvas 在不同 DPR 下的清晰度和真实渲染仍需开发者工具或真机核对。

页面现在只接受 `SelectorQuery` 返回的有效 Canvas CSS 宽度，不再使用 `320px` 猜测值或强制最小 `280px`。无有效宽度时最多重试三次；终态失败时只使用已知的上一次有效宽度清空旧 Canvas，避免新统计配上旧折线。新绘图请求使用代次令牌，旧查询结果不能覆盖新尺寸；页面卸载时设置终止标志并清理计时器，较晚到达的回调不会重新启动绘图。

重绘覆盖：

- `onReady`
- `onShow` 和本地数据重新载入
- 新增成绩
- 删除成绩
- 清空成绩
- 从其他页面或 Tab 返回
- `onResize`

成绩趋势页本身没有新手教程遮罩；教程流程未修改。从其他页面返回本页时由 `onShow` 重新测量和绘制。

## 专项几何结果

测试高度为 280，左右 padding 为 38。以下均为 CSS px。

### 不同记录数量，cssWidth = 360

| 输入数量 | 可见数量 | point.x |
| --- | ---: | --- |
| 0 | 0 | `[]` |
| 1 | 1 | `[180]` |
| 2 | 2 | `[38, 322]` |
| 3 | 3 | `[38, 180, 322]` |
| 5 | 5 | `[38, 109, 180, 251, 322]` |
| 9 | 9 | `[38, 73.5, 109, 144.5, 180, 215.5, 251, 286.5, 322]` |
| 10 | 10 | `[38, 69.556, 101.111, 132.667, 164.222, 195.778, 227.333, 258.889, 290.444, 322]` |
| 11 | 10 | 截去 `score-1`，`score-2` 至 `score-11` 重新使用上述十个位置 |

两条记录直接使用左右有效边界，不会落在前两个十分之一位置。三、五、九条均铺满有效绘图区，没有虚拟空位。

### 740、740、650 同日案例，cssWidth = 360

| 记录 | 成绩 | point.x | examNameLabel.x | dateLabel.x | 名称误差 | 日期误差 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 第一次月考 | 740 | 38 | 38 | 38 | 0 | 0 |
| 期中考试 | 740 | 180 | 180 | 180 | 0 | 0 |
| 第二次月考 | 650 | 322 | 322 | 322 | 0 | 0 |

前两个 740 的 y 完全相同；650 的视觉位置低于 740。三个 `displayIndex` 为 1、2、3，同日记录仍按创建时间独立保留。

### 不同 CSS 宽度

| cssWidth | 1 条 | 2 条 | 3 条 | 5 条 | 10 条首尾 |
| ---: | --- | --- | --- | --- | --- |
| 320 | `[160]` | `[38, 282]` | `[38, 160, 282]` | `[38, 99, 160, 221, 282]` | `38 → 282` |
| 375 | `[187.5]` | `[38, 337]` | `[38, 187.5, 337]` | `[38, 112.75, 187.5, 262.25, 337]` | `38 → 337` |
| 390 | `[195]` | `[38, 352]` | `[38, 195, 352]` | `[38, 116.5, 195, 273.5, 352]` | `38 → 352` |
| 414 | `[207]` | `[38, 376]` | `[38, 207, 376]` | `[38, 122.5, 207, 291.5, 376]` | `38 → 376` |
| 430 | `[215]` | `[38, 392]` | `[38, 215, 392]` | `[38, 126.5, 215, 303.5, 392]` | `38 → 392` |

所有宽度、所有测试数量下，相邻点间距一致；名称和日期与点的 x 误差均为 0 CSS px；首尾 point 和标签边界均未越出标签容器。

### DPR 逻辑坐标（非真实 Canvas 渲染）

| DPR | point.x | examNameLabel.x | dateLabel.x |
| ---: | --- | --- | --- |
| 1 | 基准 CSS 坐标 | 与 point 完全相同 | 与 point 完全相同 |
| 2 | backingWidth 变化，CSS x 与 DPR 1 相同 | 与 DPR 1 完全相同 | 与 DPR 1 完全相同 |
| 3 | backingWidth 变化，CSS x 与 DPR 1 相同 | 与 DPR 1 完全相同 | 与 DPR 1 完全相同 |

真实 DPR Canvas 渲染：未执行，列入人工验收。

## 测试与回归

专项命令：

```text
node scripts/verify_rc8_chart_vertical_alignment.js
```

结果：`RC8 CHART VERTICAL ALIGNMENT VERIFY PASSED`。

专项覆盖 0/1/2/3/5/9/10/11 条、同日 740/740/650、日期/创建时间/ID 排序、空名称回退、320/375/390/414/430 宽度、DPR 1/2/3 的 CSS 逻辑坐标、标签边界、点/名称/日期 ID 和 x 一致、禁止恢复固定标签列宽及固定十分之一分母。

同一专项脚本还通过页面级 mock 实际执行了 SelectorQuery 和 Canvas 命令路径：

- 360px 初始圆点、成绩数字和 data point x：`[38, 180, 322]`
- resize 到 320px 后：`[38, 160, 282]`
- 旧尺寸查询结果：已忽略
- 无效尺寸：初次加三次有限重试后停止
- 重试终态：旧 Canvas 已清空
- 页面卸载：计时器已清理，后续 schedule 不再启动

本轮小程序全量回归已通过：

- app.json 与 project.config.json JSON 解析
- app.js、正式数据文件和全量运行 JavaScript 语法
- MP1、MP2、MP4、MP5、MP6
- MP17、MP18
- RC6、RC7-1、RC7-FULL、RC8
- 740 上限、2026 数据、上传包排除
- 本地逻辑 smoke、页面逻辑 smoke
- 跨端一致性 16 项，失败项 0
- `git diff --check`

正式不变量：

- 正式名称：苏程记录
- 上一名称精确命中：0
- 更早旧品牌命中：0
- AppID：`wx17e903f81714736f`
- 学校：55
- 2025 分数线：103
- 2026 分数线：43
- 总分数线：146
- 最高分：740
- 正式数据修改：无
- 推荐规则修改：无
- 底部导航修改：无
- 新手教程修改：无
- 登录、后台、云开发、网络推荐、用户数据上传、支付、广告、定位等能力新增：无

## 开发者工具与人工验收

微信开发者工具进程存在，但 CLI 返回：

```text
IDE service port disabled
工具的服务端口已关闭
```

本轮遵守安全边界，没有开启服务端口、没有修改安全设置、没有扫码、没有预览或上传。Computer Use 读取开发者工具 Electron 窗口也超时。因此自动几何验收已完成，但以下真实页面视觉检查仍需人工完成：

1. 录入第一次月考 740、期中考试 740、第二次月考 650，日期均为 2026-07-27；
2. 确认三组成绩数字、点、名称、日期分别形成同一竖列；
3. 确认前两个点水平连接，第二个点到第三个点下降；
4. 重新进入页面后再次确认；
5. 在 DPR 1、2、3 或对应模拟设备上核对实际 Canvas 渲染和清晰度；
6. 单独记录开发者工具编译、预览和体验版状态，不以脚本 PASS 替代。

## 备份与回滚

修改前仓库外备份：

```text
/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/RC8_CHART_VERTICAL_ALIGNMENT_20260729_105555
```

备份包含页面 JS/WXML/WXSS、Canvas 绘制代码、趋势工具、相关既有测试、旧 RC8 报告和修改前 Git 状态。

安全回滚应只针对本热修复提交：优先使用普通 `git revert <hotfix-commit>` 生成可审计的反向提交；也可从上述仓库外备份逐文件恢复后重新执行专项及全量回归。不得使用 reset、clean、rebase、强推或批量覆盖。
