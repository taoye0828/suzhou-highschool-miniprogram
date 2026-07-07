# MP9 微信开发者工具 CLI 状态

- 执行时间：2026-07-07 22:24:32 +0800
- 项目路径：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 当前版本：`1.4.0`

## 安装与 CLI

- 微信开发者工具安装路径：`/Applications/wechatwebdevtools.app`
- CLI 路径：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- `/Applications` 检测结果：存在 `wechatwebdevtools.app`
- 中文应用名检测结果：未发现 `微信开发者工具.app`

## cli --help 摘要

`cli --help` 可用，显示支持以下主要命令：

- `open`：打开 IDE 或项目
- `login`：重新登录 IDE
- `islogin`：检查登录状态
- `preview`：预览
- `upload`：上传小程序
- `build-npm`：构建 NPM
- `close`：关闭项目
- `quit`：退出 IDE

`upload --help` 可用，显示上传所需参数包括：

- `--version` / `-v`：上传版本号，必填
- `--desc` / `-d`：上传版本描述，必填
- `--project`：项目路径
- `--info-output` / `-i`：可选输出信息路径

## 打开状态

- `open -a wechatwebdevtools`：成功返回
- `open /Users/tom/Dev/suzhou_highschool_miniprogram`：成功返回
- 进程检查：检测到 `wechatwebdevtools` 相关进程运行

## 服务端口与项目打开

- 服务端口是否可用：不可用
- CLI 打开项目命令：`cli open --project /Users/tom/Dev/suzhou_highschool_miniprogram`
- 是否尝试打开项目：是
- CLI 打开项目是否成功：否
- 失败原因：微信开发者工具返回“工具的服务端口已关闭”，需要用户在设置或偏好设置的安全设置中开启服务端口
- 本轮处理：没有自动开启服务端口，没有绕过确认

## AppID 与上传

- `project.config.json` 当前 AppID：`touristappid`
- 是否检测到真实 AppID：否
- 是否写入真实 AppID：否
- 是否写入 AppSecret：否
- 是否尝试上传：否
- 是否上传成功：否
- 未上传原因：
  1. 服务端口关闭。
  2. 登录状态无法通过 CLI 检查。
  3. `project.config.json` 仍为 `touristappid`。
  4. 未满足“真实 AppID + 已登录 + 服务端口可用 + 验证通过 + 上传参数清晰”的全部条件。

## 结论

微信开发者工具已安装并可打开，CLI 文件存在并可显示帮助信息，但服务端口关闭导致 CLI 无法接管项目，也无法验证登录状态或执行上传。下一步必须由用户在微信开发者工具中开启服务端口，并填写真实 AppID 后再继续。
