# 苏州高中目标查询助手

本仓库是微信小程序本地数据型工具，用于查询苏州高中阶段学校基础信息、查看官方来源可核验的历史录取分数线、收藏关注学校，并在本机记录阶段学习目标。

## MP5 状态

- 版本：1.3.0
- 状态：MP5 官方分数线核验版
- 正式学校数据：55 条
- 历史录取分数线：103 条
- 数据核对日期：2026-07-06
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

学校基础信息来自学校官网、教育局官网、政府公开网站等官方公开来源。正式页面只展示已核实字段，未核实字段不进入页面。当前版本仅收录苏州教育考试院官方来源可核验的 2025 年历史录取分数线，未核实数据不进入正式页面。当前暂未收录 2026 年学校级录取分数线，原因是尚未在固定官方来源中核验到可录入数据。历史录取分数线只收录官方来源可核验数据，不代表未来录取结果。

`mp4_` 文档文件名为历史延续，当前内容已按 MP5 状态更新。MP5 官方来源证据见 `docs/mp5_official_scores_sources.md` 和 `docs/mp5_scores_to_confirm.md`。

## 本地验证

```bash
node scripts/verify_mp1.js
node scripts/verify_mp2.js
node scripts/verify_mp4.js
node scripts/verify_mp5.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
```

微信开发者工具编译、体验版上传和提交审核不能由脚本替代，需按 `docs/mp4_manual_upload_guide.md` 在本机完成。
