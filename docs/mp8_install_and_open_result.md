# MP8 安装与打开结果

- 项目路径：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- 执行时间：2026-07-07 22:13:49 +0800
- 本轮目标：安装并打开微信开发者工具，尽量打开小程序项目，生成用户手动操作说明，并完成本地验证。

## 结果汇总

- 是否检测到 Homebrew：是
- Homebrew 路径：`/opt/homebrew/bin/brew`
- Homebrew 版本：`6.0.8`
- 是否检测到微信开发者工具：是，安装后位于 `/Applications/wechatwebdevtools.app`
- 是否尝试安装：是
- 安装命令：`brew install --cask wechatwebdevtools`
- 安装命令结果：成功，安装 `wechatwebdevtools 2.01.2510290`
- 是否成功打开微信开发者工具：是，`open -a wechatwebdevtools` 成功返回
- 是否成功打开项目目录：是，`open /Users/tom/Dev/suzhou_highschool_miniprogram` 成功返回
- 是否检测到 CLI：是，位于 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- CLI 是否在 PATH 中：否
- 是否自动导入项目：未完成，CLI 打开项目需要先启用微信开发者工具服务端口
- 是否写入真实 AppID：否
- 是否上传开发版本：否
- 是否提交审核：否
- 是否发布线上版本：否

## 需要用户手动完成的步骤

1. 在微信开发者工具中选择“小程序 -> 导入项目”。
2. 项目目录填写：`/Users/tom/Dev/suzhou_highschool_miniprogram`。
3. AppID 填写真实小程序 AppID。
4. 后端服务选择“不使用云服务”。
5. 点击“编译”。
6. 编译通过后检查首页、学校库、学校详情、收藏、学习目标、数据说明、隐私说明和我的页面。
7. 手机扫码预览并检查核心页面。
8. 确认无红色报错后上传开发版本，版本号填写 `1.4.0`。
9. 在微信公众平台设为体验版并添加体验成员。
10. 体验通过后再提交审核。

## 报错处理

如果微信开发者工具报错，请提供：

- Console 红色报错全文
- 当前页面路径
- 触发步骤
- 微信开发者工具版本
- macOS 版本
- 手机预览时的机型、系统版本和微信版本

不要只提供截图，也不要只提供最后一行错误。
