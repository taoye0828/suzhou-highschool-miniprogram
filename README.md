# 苏州高中目标查询助手

本仓库是微信小程序本地数据型工具，用于查询苏州高中阶段学校基础信息、查看官方来源可核验的历史录取分数线、收藏关注学校，并在本机记录阶段学习目标。

## MP6 状态

- 版本号：1.4.0
- 状态：MP10 已写入真实 AppID，准备微信开发者工具正确导入
- 正式学校数据：55 条
- 历史录取分数线：103 条
- 数据核对日期：2026-07-06
- 当前已收录 2025 官方历史分数线：是
- 当前暂未收录 2026 年学校级录取分数线
- 运行方式：用微信开发者工具导入本目录并编译，后端服务选择不使用云服务
- AppID：`project.config.json` 已写入 `wx17e903f81714736f`；不要写入 AppSecret

## 当前功能

- 首页说明功能边界
- 学校库搜索、区域筛选、类型筛选、住宿信息筛选、分数线状态筛选
- 学校详情展示基础信息、历史分数线、来源说明和安全提示
- 本地收藏、取消收藏、旧收藏 ID 清理
- 阶段学习目标记录、删除、清空和本地草稿
- 数据说明、隐私说明、我的页本地数据管理

## 当前不支持

- 不写入 AppSecret
- 不登录
- 不获取微信头像昵称
- 不获取手机号
- 不请求定位
- 不接支付
- 不接广告
- 不接推送
- 不接第三方统计 SDK
- 不接云开发
- 不接后台请求
- 不接 AI
- 不做录取预测
- 不提供志愿填报结论
- 不根据用户分数推荐学校

## 数据原则

学校基础信息来自学校官网、教育局官网、政府公开网站等官方公开来源。正式页面只展示已核实字段，未核实字段不进入页面。当前版本收录苏州教育考试院官方来源可核验的 2025 年历史录取分数线。历史录取分数线仅供了解，不代表未来录取结果。

## 本地验证命令

```bash
node --check app.js
node --check data/schools.js
node --check data/admission-scores.js
node scripts/verify_mp1.js
node scripts/verify_mp2.js
node scripts/verify_mp4.js
node scripts/verify_mp5.js
node scripts/verify_mp6.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
git status --short
```

## 微信开发者工具导入步骤

1. 确认 `project.config.json` 已写入真实 AppID。
2. 打开微信开发者工具。
3. 选择导入项目。
4. 项目目录选择 `/Users/tom/Dev/suzhou_highschool_miniprogram`。
5. 确认 AppID 为 `wx17e903f81714736f`。
6. 选择不使用云服务。
7. 点击编译。
8. 真机预览并按 `docs/mp6_wechat_devtools_test_checklist.md` 检查。

## 用户下一步

用户仍需在微信开发者工具中确认项目路径和 AppID、编译、真机预览、上传开发版本、设置体验版、添加体验成员、提交微信审核，并在审核通过后发布。Codex 不能替用户登录微信公众平台、上传体验版或提交审核。

## MP7 最终交付状态

- 当前代码已完成 MP6 验证。
- 当前已进入 MP10，真实 AppID 已写入 `project.config.json`。
- 用户需要用微信开发者工具编译和真机测试。
- 上传版本号建议：`1.4.0`
- 审核备注参考 `docs/mp6_review_submission_notes.md` 或 `docs/mp7_final_handoff.md`。
- 若编译失败，请复制微信开发者工具 Console 红色报错全文。
- 不能保证微信审核一定通过，审核结果以微信公众平台为准。

## MP9 微信开发者工具接管状态

- 微信开发者工具已安装：`/Applications/wechatwebdevtools.app`
- CLI 路径：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
- 当前服务端口关闭，需要用户在微信开发者工具的安全设置中手动开启。
- 当前 AppID 已在 MP10 写入 `project.config.json`。
- 上传开发版本和提交审核仍需用户确认，不会由仓库自动完成。
- MP9 文档：`docs/mp9_user_action_required.md`、`docs/mp9_devtools_cli_status.md`、`docs/mp9_final_user_checklist.md`
- 遇到微信开发者工具报错时，请提供 Console 红色报错全文。

## MP10 AppID 与微信开发者工具导入说明

- 当前 `project.config.json` 已写入 AppID：`wx17e903f81714736f`。
- 正确项目路径：`/Users/tom/Dev/suzhou_highschool_miniprogram`。
- 后端服务选择：不使用云服务。
- 如果微信开发者工具显示“快速了解云开发”，说明导入了错误项目或云开发模板。
- 应重新导入项目根目录，不要导入 `/Users/tom/Dev` 或 `miniprogram` 子目录。
- 编译前应确认左侧能直接看到 `app.js`、`app.json`、`pages`、`data`、`utils`。
- 不要填写 AppSecret，不要写入 token、密码或其他密钥。

## 回滚方式

```bash
cd /Users/tom/Dev/suzhou_highschool_miniprogram
git revert <本轮 MP6 commit hash>
```

审核结果以微信公众平台为准。本仓库准备完成不等于保证审核通过。
