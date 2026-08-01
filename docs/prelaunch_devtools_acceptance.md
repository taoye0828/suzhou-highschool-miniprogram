# PRELAUNCH-FINAL-MP 微信开发者工具验收

## 已确认环境

- 应用：`/Applications/wechatwebdevtools.app`
- 应用 bundle 版本：36.6.0
- 开发者工具内部版本：RC 2.02.2607171
- CLI：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- 配置基础库：3.7.12；由于模拟器未创建，不能声称运行时实际加载成功
- 正确项目路径：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 正式 AppID：`wxc2a2a94f767438dd`；日志确实记录了对该 AppID 的属性请求
- 正式名称：`project.config.json` 为“苏程记录”；被 Git 忽略的本机 `project.private.config.json` 已备份并把 `projectname` 从 `miniprogram` 改为“苏程记录”，未提交

## 普通编译结果

结果：`BLOCKED_ACCOUNT_NOT_DEVELOPER`，不是编译成功，也没有发现可归因于业务代码的编译错误。

开发者工具在正确路径完成项目文件读取和 `app.json` 代码分析初始化，但创建模拟器前返回：

> 登录用户不是该小程序的开发者

日志同时记录：

- `project ready, projectpath=/Users/tom/Dev/suzhou_highschool_miniprogram`
- `fetchAttr for wxc2a2a94f767438dd`
- `finish getAppJSONPromise / codeAnalysePromise`
- `SimulatorService genCreateSimulatorOptions error`，原因是登录账号无该 AppID 开发者权限

因此下列项目保持未知而非通过：

- Problems：未能进入可用项目工作区，数量 `null`
- Console 业务错误：模拟器未创建，数量 `null`
- 首页与五个 Tab：未运行
- 修复后最终普通编译：未运行

## CLI 状态

CLI 服务端口关闭。按安全边界未修改开发者工具安全设置；未执行登录、扫码、预览、上传或审核命令。

## 仓库外证据

- `screenshots/p3_project_list_correct_path.png`
- `screenshots/p3_project_open_precompile.png`
- `devtools_logs/p3_cli_open.log`
- `devtools_logs/wechat_devtools_2026-08-01-23-00-52-246.log`
- `devtools_logs/p3_relevant_log_excerpt.txt`

证据根目录：`/Users/tom/WorkData/05_Backups/suzhou_highschool_miniprogram/PRELAUNCH_FINAL_MP_20260801_224816`。
