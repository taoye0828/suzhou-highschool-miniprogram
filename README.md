# 苏州高中目标查询助手

本仓库是微信小程序本地数据型工具，用于查询苏州高中阶段学校基础信息、查看已核实历史录取分数线结构、收藏关注学校，并在本机记录阶段学习目标。

## MP4 状态

- 版本：1.2.0
- 正式学校数据：55 条
- 历史录取分数线：0 条，`admissionScores` 为空数组
- 数据核对日期：2026-07-05
- 运行方式：微信开发者工具导入本目录后编译
- AppID：仓库内保持 `touristappid`，真实 AppID 只在微信开发者工具本机填写

## 产品边界

- 不做录取预测
- 不提供志愿填报结论
- 不按用户分数给出报考结论
- 不请求定位
- 不接后台
- 不接 AI、支付、广告、推送或第三方统计 SDK
- 收藏、学习目标记录和草稿只保存在本机

## 数据原则

学校基础信息来自学校官网、教育局官网、政府公开网站等官方公开来源。正式页面只展示已核实字段，未核实字段不进入页面。历史录取分数线只有在来源、年份、区域、批次、招生类型和分数口径都清楚时才录入；当前版本未录入具体分数线。

## 本地验证

```bash
node scripts/verify_mp1.js
node scripts/verify_mp2.js
node scripts/verify_mp4.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
```

微信开发者工具编译、体验版上传和提交审核不能由脚本替代，需按 `docs/mp4_manual_upload_guide.md` 在本机完成。
