# PRELAUNCH-FINAL-MP 证据索引

仓库外证据根目录：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/PRELAUNCH_FINAL_MP_20260801_224816`。

| 验收项 | 页面或文件 | 函数/规则 | 自动测试 | 开发者工具证据 | 截图或日志 | commit |
| --- | --- | --- | --- | --- | --- | --- |
| 正式身份 | `project.config.json`、`app.json` | 名称/AppID/五 Tab | `verify_prelaunch_final`、MP18 | 正确路径与 AppID 请求已确认 | `p3_project_list_correct_path.png`、`p3_relevant_log_excerpt.txt` | `40c212f` |
| 普通编译 | 全项目 | 编译/模拟器初始化 | JS/JSON 全通过 | 账号不是开发者，未形成编译结论 | DevTools 原始日志 | 无代码修复 |
| 首页/导航 | `pages/home`、`app.json` | 首次/刷新/入口 | V1 UI、RC9 navigation、RC11 refresh | 未运行 | `p4_p12_logic_journeys.log` | 基线 + 本轮证据提交 |
| 学校路径 | schools/detail/compare | 搜索、筛选、收藏、目标、对比 | V1 school、RC9 filters/integration、RC10 compare | 未运行 | `p4_p12_logic_journeys.log` | 基线 |
| 成绩路径 | score-trend、exam-settings | 考试、模板、方案、趋势、资格 | V1 exam/trend、RC8 chart、RC9 score | 未运行 | `p4_p12_logic_journeys.log` | 基线 |
| 学习闭环 | score-trend、targets | 复盘、失分、错题、任务、周计划、阶段 | V1 learning、RC10 task/goal | 未运行 | `p4_p12_logic_journeys.log` | 基线 |
| 历史分差 | targets | 固定分组与 5 所上限 | V1/RC9 target | 未运行 | 自动回归日志 | 基线 |
| 多档案 | profile-management | 档案隔离与恢复 | RC11-1 multi-profile、RC11-2 isolation | 未运行 | 自动回归日志 | 基线 |
| 备份/恢复/报告 | backup-restore、restore-points、reports | v2/v3、v1/v2、FakeFileShareAdapter | V1 backup/recovery/report、RC11-2 | 未运行真实分享 | 自动回归日志 | `34fc36e` |
| 启动恢复 | storage/recovery | 12 状态、锁、幂等 | RC11-2 full | 不对真实 Storage 注入 | 自动回归日志 | 基线 |
| 多尺寸 | score-trend、全页面 | 坐标与静态可访问性 | RC8 chart、RC10 accessibility | 全页面未运行 | `p13_p15_static_acceptance.log` | 基线 |
| 隐私合规 | config/help/backup/reports | 开发者服务器与主动分享边界 | PRELAUNCH、MP6、smoke、cross-platform | UI 复验未运行 | `p18_explicit_final_regression.log` | `34fc36e`、`b8bdb1c` |
| 上传包 | `project.config.json` | 22 条 ignore | upload-package gate | 未上传 | `upload_package_inventory_final_precommit.json` | 基线 |
| 正式数据 | `data/*.js` | 55/103/43/146/0/740 与 SHA-256 | V1 freeze、score max | 不适用 | P2/P18 日志 | 未修改 |
| Git | 仓库 | 普通 commit/push | diff/hash gates | 不适用 | `START_STATE.txt` 与最终 Git gate | 本轮提交 |

证据文件所在提交的 SHA 无法自引用写入自身内容；最终 HEAD、`origin/main` 和 ahead/behind 由证据提交后的最终 Git 门禁记录，并在最终交接中给出。
