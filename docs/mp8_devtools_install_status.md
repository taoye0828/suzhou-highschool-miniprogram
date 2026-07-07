# MP8 微信开发者工具安装状态记录

- 执行时间：2026-07-07 22:13:49 +0800
- 项目路径：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 当前用途：本机安装和打开微信开发者工具，准备用户手动填写真实 AppID 后进行编译、预览、上传和审核。

## 开始前 Git 状态

- 分支：`main`
- `git status --short`：空
- 开始前 `HEAD`：`e8f7f23efde89dc0179d3464fc78a3265d733bd9`
- 开始前 `origin/main`：`e8f7f23efde89dc0179d3464fc78a3265d733bd9`
- `.git/index.lock`：未发现
- `app.json`：存在
- `project.config.json`：存在

## 系统环境

- 芯片架构：`arm64`
- macOS：`26.5.1`
- Build：`25F80`
- Homebrew 路径：`/opt/homebrew/bin/brew`
- Homebrew 版本：安装前检测为 `6.0.2`，安装自动更新后检测为 `6.0.8`

## 安装前检测

- `/Applications`：未发现 `微信开发者工具.app` 或 `wechatwebdevtools.app`
- Spotlight `微信开发者工具.app`：未发现
- Spotlight `wechatwebdevtools.app`：未发现
- PATH 中 `cli`：未发现
- PATH 中 `wechatwebdevtools`：未发现

## 安装动作

- 执行命令：`brew install --cask wechatwebdevtools`
- 安装结果：成功
- 安装版本：`wechatwebdevtools 2.01.2510290`
- 安装位置：`/Applications/wechatwebdevtools.app`
- 备注：Homebrew 安装过程中自动更新了本地 Homebrew 索引。

## 安装后检测

- `/Applications/wechatwebdevtools.app`：已存在
- Spotlight `wechatwebdevtools.app`：`/Applications/wechatwebdevtools.app`
- PATH 中 `cli`：未发现
- PATH 中 `wechatwebdevtools`：未发现
- App Bundle CLI：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- App Bundle 可执行文件：`/Applications/wechatwebdevtools.app/Contents/MacOS/wechatwebdevtools`

## 打开结果

- `open -a "微信开发者工具"`：失败，系统未注册中文应用名
- `open -a "wechatwebdevtools"`：成功返回
- `open /Users/tom/Dev/suzhou_highschool_miniprogram`：成功返回
- CLI 帮助命令：成功，确认支持 `open`、`preview`、`upload` 等命令
- CLI 打开项目命令：尝试执行 `cli open --project /Users/tom/Dev/suzhou_highschool_miniprogram`
- CLI 打开项目结果：未自动导入，原因是微信开发者工具服务端口关闭，需要用户在工具内手动开启或手动导入项目
- 安全处理：未自动开启服务端口，未执行预览、上传、提交审核或发布命令
