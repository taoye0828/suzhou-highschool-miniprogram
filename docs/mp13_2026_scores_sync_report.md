# MP13 2026 分数线同步报告

## 来源核验结果

- 官方网站：未找到可核验的 2026 分数线官网页面，本轮未使用 officialWebsite 入库。
- 官方公众号：3 个候选链接均被微信环境验证拦截，主体和发布时间无法确认，本轮未使用 officialWeChat 入库。
- 媒体转载官方图：名城苏州/引力播页面明写“苏州市教育考试院供图”，图片清晰且带考试院水印，本轮作为 officialImageViaMedia 入库。
- 结构化候选：苏州本地宝仅作辅助候选说明，未直接作为 sourceUrl 入库。

## 数据结果

- 学校数据：55 条，未修改 data/schools.js。
- 2025 历史分数线：103 条，保持不变。
- 2026 候选记录：55 条。
- 2026 正式入库：43 条。
- 被排除记录：12 条及扬子晚报第一批源级候选。
- 总历史分数线：146 条。

## 被排除原因

- 官网和公众号证据不足。
- 第一批候选页面未明写官方供图来源。
- 空分数、未匹配 schoolId、5+2/高职贯通、职教高考班、现代职教体系项目、中职/高职、控制线均排除。
- 非整数综合成绩或文化分+体育分口径暂不混入当前普通分数线展示。

## 页面更新内容

- 首页新增动态数据概况：学校数、历史分数线总数、已收录年份。
- 学校详情沿用按年份倒序分组，2026 会排在 2025 前。
- 学校库“有分数线”筛选继续按任一年有分数线判断。
- 数据说明更新为 2025、2026 年官方历史分数线。

## 740 满分保持情况

- 学习目标上限仍为 740。
- 741 / 750 仍应被拒绝。
- 本轮未新增登录、定位、支付、广告、AI、预测或志愿推荐字段。

## 验证命令

运行清单：

```bash
node -e "JSON.parse(require('fs').readFileSync('project.config.json','utf8')); console.log('project.config.json JSON OK')"
node --check app.js
node --check data/schools.js
node --check data/admission-scores.js
node scripts/verify_mp1.js
node scripts/verify_mp2.js
node scripts/verify_mp4.js
node scripts/verify_mp5.js
node scripts/verify_mp6.js
node scripts/verify_score_max_740.js
node scripts/verify_mp13_2026_scores.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

## 用户重新上传开发版前应检查

1. 使用微信开发者工具打开 /Users/tom/Dev/suzhou_highschool_miniprogram。
2. 编译后检查首页数据概况显示 2025、2026。
3. 打开江苏省苏州中学校详情，确认 2026 分数线显示在 2025 前。
4. 打开学习目标，确认 740 可保存、741 和 750 被拒绝。
5. 确认页面不出现录取预测、志愿推荐、登录、定位、支付、广告或 AI 文案。
