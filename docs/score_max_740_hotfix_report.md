# SCORE-MAX-HOTFIX：苏州中考满分 740 修复报告

## 修复原因与位置

学习目标必须以苏州中考满分 740 分为上限。检查发现原配置把目标分上限写成 750，且两处历史分数线结构校验也把 750 当作可接受上限。本次将这些运行和校验规则统一到 740，不改任何历史分数线具体值。

## 修改内容

- 统一常量 `EXAM_TOTAL_SCORE = 740`，目标输入、占位提示和保存校验均由该常量驱动。
- 740 可保存；741 和 750 均拒绝，目标分超限提示为“目标分不能超过 740 分”。
- 超出 740 时不再计算正常学习差距。
- 已存在的超 740 本地记录仍会加载和展示，不会静默删除；再次保存时必须修正到 740 以内。
- 新增 `scripts/verify_score_max_740.js`，验证边界、错误文案、运行逻辑、AppID，以及数据文件哈希和条数。

## 数据影响

- `data/schools.js`：未修改，当前 55 条。
- `data/admission-scores.js`：未修改，当前 103 条，均为 2025。
- 当前远端 `main` 没有 2026 分数线记录；本轮未新增、删除或同步 2026 数据。

## 验证命令

- `node scripts/verify_mp1.js`、`verify_mp2.js`、`verify_mp4.js`、`verify_mp5.js`、`verify_mp6.js`
- `node scripts/verify_score_max_740.js`
- `node scripts/smoke_local_logic.js`
- `node scripts/smoke_page_logic.js`
- 全部 JavaScript `node --check`
- `git diff --check`

## 重新上传体验版前检查

1. 确认微信开发者工具打开的是 `/Users/tom/Dev/suzhou_highschool_miniprogram`。
2. 清缓存并重新编译，确认 AppID 仍为 `wx17e903f81714736f`。
3. 在学习目标页测试 740、741、750；只有 740 可以保存。
4. 如设备存在旧的超 740 记录，确认仍显示且新保存会要求修正。
5. 上传新体验版后重新扫码，避免继续使用旧体验版缓存。
