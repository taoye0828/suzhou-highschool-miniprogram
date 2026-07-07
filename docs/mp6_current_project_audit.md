# MP6 当前项目状态审计

## Git 与版本

- 当前 commit：1d81a9e510035f3431b79226e36e8487cef0b090
- 当前版本号：1.3.0
- 当前 releaseStatus：MP5 官方分数线核验版
- 是否已完成 MP4：是，存在 MP4 文档、verify_mp4.js、学校基础数据与页面结构
- 是否已完成 MP5：是，当前提交为 `data: add verified 2025 official admission scores mp5`，存在 verify_mp5.js、MP5 官方来源页面与图片证据、2025 官方历史分数线数据

## 数据状态

- schools 数量：55
- candidate school 数量：54
- admissionScores 数量：103
- 是否存在 2025 官方历史分数线：是，103 条，来源为苏州教育考试院官方页面证据
- 是否存在 2026 学校级分数线：否

## 安全与能力边界

- 是否存在真实 AppID：否，project.config.json 当前为 `touristappid`
- 是否存在 AppSecret：未发现运行配置写入 AppSecret
- 是否存在 wx.login：未发现运行代码调用
- 是否存在定位、支付、广告、云开发、后台请求：未发现运行代码调用定位、支付、广告、云开发或后台请求 API

## 项目结构

- app.json 注册页面是否完整：当前注册 8 个页面，页面文件存在
- tabBar 页面是否完整：当前包含首页、学校库、收藏、学习目标、我的
- project.config.json 是否可导入：配置存在，compileType 为 miniprogram，miniprogramRoot 为 `./`，AppID 为占位值
- README 是否与当前版本一致：与 MP5 一致，需要升级到 MP6
- docs 是否与当前版本一致：MP5/MP4 文档存在，需要补充 MP6 最终收口文档

## Codex 可修复事项

- 升级 config/app-config.js 到 1.4.0 和 MP6 releaseStatus
- 更新 project.config.json description 到 MP6
- 更新 README 到 MP6 状态和最终验证命令
- 新增 MP6 用户手动步骤、真机测试清单、审核备注和最终 readiness 文档
- 新增 verify_mp6.js，并确保 verify_mp5.js 可在当前 MP5 数据下继续通过
- 更新 smoke 脚本覆盖住宿筛选、分数线筛选、旧 ID、损坏缓存、非法输入、清空记录、数据说明和隐私说明加载
- 补充我的页学校数量与分数线数量展示
- 统一学校库与详情页分数线 badge 文案
- 保留不登录、不定位、不支付、不广告、不云开发、不后台请求边界

## 用户必须手动完成事项

- 获取真实 AppID
- 在微信开发者工具或本地 project.config.json 中填写真实 AppID
- 打开微信开发者工具导入项目
- 选择不使用云服务
- 编译和真机预览
- 上传开发版本
- 设置体验版并添加体验成员
- 提交微信审核
- 审核通过后发布线上版本
