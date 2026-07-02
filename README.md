# 苏州高中目标查询助手（微信小程序 MP1）

原生微信小程序本地版，使用 WXML、WXSS、JavaScript 和 JSON。当前不连接后台、云开发或远程 API，不需要登录；收藏、目标记录和输入草稿只保存在微信小程序本地缓存。当前版本为 `1.0.1-mp1`。

## 导入微信开发者工具

1. 打开微信开发者工具并选择“导入项目”。
2. 项目目录选择本目录：`/Users/tom/Dev/suzhou_highschool_miniprogram`。
3. 本地预览可保留 `project.config.json` 中的 `touristappid`。
4. 上传开发版本前，在微信开发者工具中绑定用户自己的真实小程序 AppID。
5. 不要在前端代码、文档或 Git 中填写 AppSecret。

## 页面

- 首页
- 学校库
- 学校详情
- 收藏
- 目标记录
- 数据说明
- 隐私说明
- 我的 / 设置

## 本地验证

```sh
node scripts/verify_mp1.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
```

`verify_mp1.js` 只提供补充静态检查，不代表微信开发者工具编译通过。提交前仍必须在微信开发者工具中完成实际编译、页面操作和真机预览。

本地存储层会过滤损坏或旧格式记录，捕获读取、写入和删除异常，并将目标记录限制为最多 100 条。草稿输入采用 400ms 防抖保存。

## 数据边界

学校库包含明显虚构的演示学校，以及从现有 Flutter P4 资产中复制的少量公开来源基础样本。仅保留学校名称、区域、类型、住宿核验状态、数据状态、简介标签和来源类别说明；不包含分数、电话、照片、地址、坐标或用户距离。

地图功能只提供复制学校名称、复制“学校名称 + 苏州”搜索词和外部地图搜索说明。这样不请求定位、不依赖地图 SDK，也不使用未经核验的坐标。

详见 [提交前清单](docs/mp1_submission_checklist.md) 和 [审核材料](docs/mp1_review_materials.md)。
