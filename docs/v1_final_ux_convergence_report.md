# 微信小程序 V1 首发 UX 收口报告

报告日期：2026-08-04

仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`

分支：`fix/v1-final-ux-miniprogram-20260804`

## 1. 开始 Git 状态

- 开始工作区：clean，无已暂存或未暂存修改。
- 开始分支：`fix/v1-final-ux-miniprogram-20260804`。
- 开始 HEAD：`163b3a215563e6b0f46427dd92ecde2e78186547`。
- `origin/main`：`f099c298a127f499ac0aa24d69ccd338ee5c53c2`。
- `.git/index.lock`：不存在。
- `git fetch origin`：成功。
- 提交 `163b3a2`：真实存在，是当前分支 HEAD，也是远程同名分支 HEAD，开始时 ahead/behind 为 `0/0`。
- 未创建新分支，未切换或修改 `main`，未执行 reset、rebase、clean、force push 或 `git add .`。
- 仓库没有 `package.json`，验证直接运行 `scripts/*.js`。

## 2. 上一次提交的真实核查结果

`163b3a2` 修改 9 个文件，完成了档案高级选项隐藏、帮助入口和初版专项脚本，但存在以下未完成项：

1. 目标规划仍保留 `100 * index / (count - 1)`，只是改写等价公式并增加注释，没有共享横坐标实现。
2. 飞书问卷仍使用旧链接。
3. 专项脚本只断言注释和独立公式存在，因此不能证明两个页面共用算法。
4. 教程高亮测量失败后保留硬编码白色高亮框，存在错误空白聚光区域风险。
5. 报告把上述未完成项写成已完成，需要纠正。

## 3. 飞书反馈链接

- 历史旧链接（仅用于本报告说明差异，不参与运行）：`https://ycn8xfqnmoql.feishu.cn/share/base/form/shrcng2vmqyiVYLULDAEbJNWhtg55`
- 正式新链接：`https://ycn8xfqnmoql.feishu.cn/share/base/form/shrcng2vmqyiVYLULDAEbJNWhtg`
- 正式运行位置：`pages/help/help.js`。
- 复制实现：`wx.setClipboardData`。
- 成功提示：`反馈链接已复制，请粘贴到浏览器中打开。`
- 失败提示：`复制失败，请稍后重试。`
- 最终搜索：旧链接在正式运行代码中 0 处，仅在本报告的历史差异说明中保留 1 处；新链接存在于运行代码和对应专项测试中。
- 未新增 `wx.request`、登录、云开发、上传、客服聊天、消息中心、工单或反馈状态系统。

## 4. 趋势图横坐标统一

### 4.1 最初误判

`index * 100 / (count - 1)` 与 `100 * index / (count - 1)` 数学等价。换写法、加括号或注释都不构成修复。真正问题是成绩趋势图和目标规划图各自维护 x 算法、padding 和边缘处理，后续容易让点、分数、考试名称和日期标签发生漂移。

### 4.2 最终公共实现

在 `utils/score-trend.js` 增加并导出纯函数：

```text
calculateTrendXPositions(count, width, padding)
  -> [{ x, leftPercent }]
```

函数统一处理：

- 0 条返回空数组；
- 1 条居中；
- 多条在左右 padding 内等距；
- 非法 width 回退到安全宽度；
- 负数或非法 padding 回退为 0；
- 过大 padding 截断到宽度一半；
- 同时提供像素 `x` 和标准化 `leftPercent`。

成绩趋势页 `pages/score-trend/score-trend.js` 显式调用 `calculateTrendXPositions`，并把结果传入 `calculateChartPoints`；Canvas 点、分数文字、考试名称和日期标签都使用这一组位置。

目标规划页 `pages/targets/targets.js` 显式调用同一个 `calculateTrendXPositions`。目标图继续保留自己的 y 坐标、参考分数线和滚动宽度；原 CSS 左右 `56rpx` padding 转为公共函数参数，视觉首尾位置不变。`pointStyle`、`scoreStyle`、`labelStyle` 全部来自同一个 `leftPercent`，独立 index 百分比公式已删除。

### 4.3 指定数据与边界

指定数据 `740, 680, 650, 700, 725` 的自动测试结果：

- 考试名称顺序为 `1, 2, 3, 4, 5`；
- 第一条最高；第二、第三条连续下降；第四、第五条连续回升；
- 没有生成虚假 0 分；
- 点与分数/考试名称/日期共用 x；
- 首尾点位于 padding 内。

同时覆盖：0、1、2、3、5、10、超过 10 条、同一天多次考试、相同分数、真实 0 分、740 分、非法宽度和非法 padding。超过 10 条只保留最近 10 条。

## 5. 学生档案与 favoritesMode

调用链核查确认 `favoritesMode` 有真实业务作用：

- `independent` 读写当前档案 `favoriteSchoolIds`；
- `shared` 读写 `sharedFavoriteSchoolIds`；
- 备份、恢复、迁移和多档案隔离均保留该字段及兼容逻辑。

产品处理结果：

- 新建档案由 `normalizeProfile` 默认设为 `independent`；
- 首次创建和档案列表不显示“收藏独立/收藏共享”高级选项；
- 改名只提交 `{ nickname }`，不会覆盖已有 `favoritesMode`；
- 自动测试创建 shared 档案、写入收藏、改名后再次读取，shared 状态和收藏均保留；
- 未修改 Storage Schema、迁移链、备份格式、恢复点格式或旧数据。

创建界面当前使用微信原生 editable modal，只要求昵称，没有中考年份 picker，因此“年份选择遮挡”不适用；取消通过 `modal.confirm` 分支返回，创建按钮会实际调用 `createStudentProfile`。输入截断、键盘和小屏按钮可见性仍需真机验收。

## 6. 新手教程

实际实现由 `utils/onboarding.js`、`components/onboarding-overlay` 和各 Tab 页共同组成：

- 教程状态保存在本地 onboarding state；
- 支持下一步、上一步、跳过、开始使用/完成；
- 跳过和完成都会关闭自动展示；
- “我的 → 帮助与反馈”可以重播完整教程、功能教程和状态型帮助。

本轮发现并修复真实问题：组件原先在测量前显示硬编码高亮，`boundingClientRect` 连续失败后也不会移除，可能形成与真实控件脱离的白色高亮块。

最终行为：

- 默认 `highlightVisible=false`；
- 页面 setData 完成后再通过 `wx.nextTick` 测量；
- 最多重试 3 次；
- 只有拿到有限、正尺寸、位于可见窗口和安全区内的 rect 才显示高亮；
- 测量失败或目标在屏幕外时不显示高亮，保留底部普通说明卡片和全部操作按钮；
- 说明卡片优先放在目标下方，空间不足时放上方，并避开顶部/底部安全区。

Node harness 已覆盖测量失败、测量成功、目标在屏幕外三条路径。真实控件位置、状态栏、TabBar 和不同设备安全区属于 `external_manual_acceptance`。

## 7. 关闭、取消、跳过和操作按钮

自动扫描 `pages/` 与 `components/` 的所有用户可见 `bindtap`/`catchtap`，每个 handler 均在对应 JS 中存在。重点结果：

- 教程“跳过”：调用 `skipOnboarding` 并持久化 skipped。
- 教程“上一步”：更新 step 并路由到对应 Tab/页面。
- 教程“下一步”：更新 step；最后一步转为 complete。
- “开始使用”：持久化 completed 并关闭教程。
- 状态帮助“关闭”：持久化 dismissed，并立即从页面移除。
- 档案弹窗“取消”：原生 modal 返回时不写数据。
- 档案“创建”：校验昵称后创建并切换档案。
- 帮助反馈按钮：复制正式链接，并覆盖成功/失败路径。
- 未发现装饰性 X，也未盲目新增关闭按钮。

透明层、真实点击热区和键盘弹起后的可操作性不能由 Node 证明，保留人工验收。

## 8. 帮助与反馈

- “我的”入口文案：`帮助与反馈`。
- 页面导航标题：`帮助与反馈`。
- 页面包含使用说明、完整/按功能教程、常见问题、反馈问卷和隐私提醒。
- 常见问题明确说明：不做录取预测；用户数据不会自动上传；不提供志愿填报建议；历史分数线仅用于目标规划参考。
- 隐私提醒：提交截图前遮挡姓名、联系方式；不要提交密码、身份证号等敏感信息。
- 反馈采用复制正式链接，不新增 web-view 或网络请求。

## 9. 测试命令和结果

实际执行并通过：

```bash
node scripts/verify_v1_final_ux.js
node scripts/verify_rc9_full.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
node scripts/verify_v1_full.js --all-verify
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

结果摘要：

- V1 UX 专项：全部通过。
- RC9 full：14 个专项脚本全部通过。
- V1 full：103 个 TEST-ID 全部通过。
- all-verify：87 个正式 verify 脚本全部通过，包括 MP1/2/4/5/6、2026 分数线、上传包 ignore、RC6/7/8/9/10/11、首发冻结和数据保护门禁。
- local/page smoke：全部通过。
- 全仓 JavaScript `node --check`：通过。
- `git diff --check`：通过。

第一次完整 verify 运行曾出现 `verify_prelaunch_final.js` 1 项失败，因为该门禁会拦截任何可见的“志愿推荐”营销短语，包括否定句。未削弱门禁，改为“当前提供志愿填报建议吗？—不提供”后，重新运行 87/87 全部通过。

`--all-verify` 按仓库既有定义包含一次对相邻 Flutter 正式数据的只读一致性检查；未传 `--write-report`，未修改、暂存或提交 Flutter 仓库。

## 10. 正式数据保护

- 学校数据：55，未变化。
- 分数线：146（2025=103、2026=43），未变化。
- schoolId 和三份正式数据哈希：门禁通过。
- 满分规则：740，未变化。
- AppID：`wxc2a2a94f767438dd`，未变化。
- 小程序名称：`苏程记录`，未变化。
- Storage Schema：5，未变化。
- Backup 格式版本：3，未变化。
- Restore Point 格式版本：2，未变化。
- 事务系统、恢复系统和迁移核心逻辑：未修改。
- `git diff origin/main --name-only` 中没有 `data/`、`shared-spec/`、`project.config.json`、`app.json`、产品规则、存储、迁移、Backup/Restore 正式文件。

## 11. 修改文件清单

当前分支相对 `origin/main` 的 UX 收口文件：

```text
components/onboarding-overlay/onboarding-overlay.js
components/onboarding-overlay/onboarding-overlay.wxml
docs/v1_final_ux_convergence_report.md
pages/help/help.js
pages/help/help.json
pages/help/help.wxml
pages/profile-management/profile-management.wxml
pages/profile/profile.wxml
pages/score-trend/score-trend.js
pages/targets/targets.js
pages/targets/targets.wxss
scripts/verify_rc8.js
scripts/verify_rc9_navigation_fusion.js
scripts/verify_rc9_onboarding_help.js
scripts/verify_v1_final_ux.js
utils/score-trend.js
```

## 12. external_manual_acceptance

以下项目未被 Node 自动测试冒充为通过，必须在微信开发者工具或真机确认：

- 微信开发者工具普通编译；
- Problems 面板；
- Console；
- 320/375/390/414/430 宽度；
- iPhone 真机；
- 完整教程每一步的真实高亮位置、上下卡片位置、上一/下一/跳过/完成；
- 档案创建弹窗的输入、键盘、取消和创建；
- 帮助与反馈复制后的真实系统剪贴板内容；
- 指定 740/680/650/700/725 趋势；
- 成绩图和目标图首尾点、分数、考试名称、日期是否裁切；
- 透明层、TabBar、状态栏和底部安全区是否影响点击。

## 13. 备份与回滚

修改前备份位于：

`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/v1_final_ux_20260804_20260804_203925`

备份在仓库外，不进入上传包或 Git。提交后如需整体回滚，优先对本轮最终提交执行普通 `git revert <commit>`；也可从上述备份逐文件比对恢复。禁止 reset、clean 和强制推送。

## 14. 结论

- 自动验证范围内未发现 P0。
- 自动验证范围内未发现 P1。
- 可以进入微信开发者工具与真机人工验收。
- 不建议立即合并 `main`：应先完成 `external_manual_acceptance`，尤其是教程真实高亮、档案弹窗、剪贴板和两张趋势图首尾裁切。
- 本轮只修改微信小程序仓库，不合并 `main`。
