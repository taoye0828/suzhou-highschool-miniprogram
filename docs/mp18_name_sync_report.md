# MP18 名称同步报告

生成日期：2026-07-27

当前正式名称：苏程记录

## 目标与边界

本轮只同步微信小程序正式名称、当前文档和名称断言。Flutter 仓库、正式学校与分数线数据、页面路径、底部导航、推荐算法、成绩趋势算法、本地存储结构和新手教程步骤均不在修改范围内。

## 开始前门禁

- 仓库：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 分支：`main`
- 开始前 HEAD：`73f97435a511a17c5ba7197aa3247807f1f2b890`
- 开始前本地 `origin/main`：`73f97435a511a17c5ba7197aa3247807f1f2b890`
- 工作区：干净
- `.git/index.lock`：不存在
- AppID：`wx17e903f81714736f`
- AppID 变化：无
- 上一正式名称初始精确命中：20 处，分布在 13 个文件
- 更早旧品牌及明显变体：0 处
- 新名称初始命中：0 处

首次远端拉取因 GitHub HTTPS 连接停在 `SYN_SENT`，未返回远端新数据；挂起的只读进程已自然结束，没有改动仓库。开始修改时本地 HEAD 与现有 `origin/main` 一致。

## 实施内容

### 运行时与配置

- `config/app-config.js`：统一正式名称源。
- `app.json`：同步全局导航标题。
- `pages/home/home.json`：同步首页导航标题；其他功能页继续保留自身标题。
- `project.config.json`：只同步安全的 `description` 字段；AppID、`compileType`、`miniprogramRoot` 和 `packOptions.ignore` 保持不变。
- `app.js`：继续通过 `APP_CONFIG.name` 读取正式名称，无需改动。
- `project.private.config.json`：不存在旧名称，未修改，也未加入 Git。

### 数据说明、隐私说明和新手教程

- 数据说明页继续通过 `APP_CONFIG.name` 展示正式名称。
- 隐私说明页继续通过 `APP_CONFIG.name` 展示正式名称。
- 新手教程欢迎语继续通过 `APP_CONFIG.name` 生成；7 个步骤、路由、完成与跳过行为均未改变。
- 首页没有新增品牌大卡、版本卡、统计卡或宣传卡。

### README、当前文档与测试

- README 标题、项目名称和验证命令已同步。
- 当前 `docs/` 中所有上一正式名称均已替换；历史数字、日期、SHA 和任务事实未改变。
- `scripts/verify_mp6.js` 与 `scripts/verify_mp17_name_sync.js` 的当前名称断言已同步。
- 新增 `scripts/verify_mp18_name_sync.js`，覆盖名称清零、旧品牌变体、功能页标题、AppID、数据数量、740 上限、AppSecret、登录、云开发、AI 与网络请求能力边界。

## 不变量

- 页面路径：未改变
- 五项底部导航：未改变
- 推荐算法：未改变
- 成绩趋势算法：未改变
- 新手教程步骤：未改变
- 学校数据：55 所，未修改
- 2025 年分数线：103 条，未修改
- 2026 年分数线：43 条，未修改
- 总分数线：146 条，未修改
- 中考满分上限：740，未修改
- 官方来源 URL、`schoolId`、`scoreId`：未修改
- 登录、后台、AI、云开发、支付、广告、定位、用户数据上传和新增网络请求：均未新增
- Flutter 仓库：未修改

## 验证口径

提交前已执行并通过：

- JSON：`project.config.json`、`app.json`
- JavaScript：入口、数据文件和仓库内非文档 JS 全量语法检查
- 基线：MP1、MP2、MP4、MP5、MP6
- 名称：MP17、MP18
- 功能：RC6、RC7-1、RC7-FULL、RC8
- 数据与上传：740 上限、2026 数据、上传包忽略
- 回归：本地逻辑 smoke、页面逻辑 smoke、`git diff --check`
- 跨端一致性：16 项全部通过，学校和分数线哈希一致

页面 smoke 中打印的存储写入/删除失败是测试主动注入的异常分支，脚本最终结果为 `PAGE LOGIC SMOKE PASSED`。

名称扫描结果：

- 上一正式名称最终精确命中：0
- 更早旧品牌精确命中：0
- 更早旧品牌明显变体命中：0
- 当前正式名称命中：22
- 页面标题种类：13
- MP18 专项验证：`MP18 NAME SYNC VERIFY PASSED`

微信开发者工具编译、Problems、Console 和页面人工核对与本地脚本结果分开记录。

## 备份与回滚

- 仓库外备份：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/MP18_NAME_SYNC_20260727_230725`
- 备份包含 README、运行配置、页面、组件、工具、当前文档、脚本、开始前 Git 状态、开始前 HEAD 和预计修改文件清单。
- 安全回滚：推送后使用 `git revert <MP18 commit>` 生成反向提交；也可从上述备份按文件核对恢复。不得使用 reset、clean、rebase 或 force push。

## 尚需平台验收

微信开发者工具 Stable `2.02.2607171` 正在运行，相关进程的当前目录为正确小程序仓库。Computer Use 无法读取该 Electron 窗口的可访问性状态；官方 CLI 返回“工具的服务端口已关闭”。开启 CLI 服务端口需要修改“设置 → 安全设置”，本轮按禁止事项没有开启。

因此以下事项保持人工待验收：

- 重新编译及 Problems/Console 检查
- 首页和全局标题
- 数据说明与隐私说明
- 新手教程欢迎语、完成行为和 7 个步骤
- 冗余宣传卡未恢复的页面核对
- 手机预览与体验版

本地脚本验证不替代上述平台验收。本轮没有上传体验版、提交审核、扫码登录或修改开发者工具安全设置。
