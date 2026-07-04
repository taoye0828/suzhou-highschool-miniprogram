# MP2 提交前清单

## 代码项

- [ ] 页面完整：8 个页面均可访问。
- [ ] 数据完整：学校数据不少于 20 条，示例学校不超过 3 条。
- [ ] 禁止 API 未使用：不登录、不定位、不支付、不订阅消息、不发起远程请求、不使用 socket。
- [ ] 密钥未出现：代码、文档和 Git 中不包含 AppSecret、API Key、Token、Cookie、账号密码。
- [ ] 本地测试通过：
  - `node scripts/verify_mp1.js`
  - `node scripts/verify_mp2.js`
  - `node scripts/smoke_local_logic.js`
  - `node scripts/smoke_page_logic.js`
  - `find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check`

## 用户人工项

- [ ] 注册或确认小程序账号。
- [ ] 完成认证主体。
- [ ] 获取真实 AppID。
- [ ] 替换 `touristappid`。
- [ ] 完成小程序备案。
- [ ] 选择服务类目。
- [ ] 填写微信公众平台隐私保护指引。
- [ ] 在微信开发者工具中编译。
- [ ] 微信开发者工具真机预览。
- [ ] 上传体验版。
- [ ] 设置体验成员并复测。
- [ ] 填写版本说明和审核备注。
- [ ] 提交审核。
- [ ] 审核通过后发布。

## AppID 与 AppSecret

本地预览可使用 `touristappid`。上传体验版前必须换成微信公众平台真实 AppID。AppSecret 不要写入前端代码、README、文档、日志或 Git。
