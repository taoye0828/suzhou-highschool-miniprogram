# MP16 小程序上传包清理报告

## 本轮目标

本轮只处理上传包体积和开发资料排除，不新增功能、不新增数据、不修改学校、分数线、满分规则或 `schoolId`。

核心目标：

- 通过 `project.config.json` 的 `packOptions.ignore` 排除开发资料，减小微信小程序上传包。
- 保留 GitHub 中的开发文档、官方来源证据、验证脚本和审计资料。
- 确认小程序运行时不依赖 `docs`、`scripts`、`README.md` 或官方缓存页面。
- 确认 55 所学校、2025 年 103 条分数线、2026 年 43 条分数线、总计 146 条历史分数线和 740 满分规则不受影响。

## 为什么不直接删除 docs / scripts

`docs` 和 `scripts` 不属于小程序运行时文件，但它们是后续维护需要的开发资料：

- `docs` 保存阶段审计、发布说明、官方分数线来源、官方图片缓存和官方页面缓存。
- `scripts` 保存本地静态验证、数据一致性验证和页面逻辑 smoke test。
- `README.md` 记录当前版本状态、边界和人工重新编译检查方式。

所以本轮采用“GitHub 保留、上传包排除”的方式，而不是删除这些资料。

## 运行时必要文件

以下文件和目录必须保留，且不得被 `packOptions.ignore` 排除：

- `app.js`
- `app.json`
- `app.wxss`
- `sitemap.json`
- `project.config.json`
- `pages/`
- `data/`
- `utils/`
- `config/`
- `styles/`

## 开发资料和缓存

以下内容属于开发、验证或溯源资料，应保留在 GitHub，但不进入小程序上传包：

- `docs/`
- `scripts/`
- `README.md`
- `docs/mp5_official_images/`
- `docs/mp5_official_pages/`
- `docs/**/*.html`
- `docs/**/*.jpg`
- `docs/**/*.jpeg`
- `docs/**/*.png`
- `docs/**/*.md`
- 常见本地依赖、临时输出、日志和 IDE 配置目录

## packOptions.ignore 更新

本轮在 `project.config.json` 中补齐以下上传包排除规则：

- `docs` folder
- `docs/mp5_official_images` folder
- `docs/mp5_official_pages` folder
- `^docs/.*\\.html$` regexp
- `^docs/.*\\.jpe?g$` regexp
- `^docs/.*\\.png$` regexp
- `^docs/.*\\.md$` regexp
- `scripts` folder
- `README.md` file
- `.md` suffix
- `.git` folder
- `.DS_Store` file
- `node_modules` folder
- `package-lock.json` file
- `package.json` file
- `backups` folder
- `tmp` folder
- `coverage` folder
- `.log` suffix
- `.vscode` folder
- `.idea` folder

未排除运行时入口和目录：`app.js`、`app.json`、`app.wxss`、`sitemap.json`、`pages/`、`data/`、`utils/`、`config/`、`styles/`。

## 体积分布

本轮只读统计结果：

- 项目整体：3.5M
- `docs`：1.5M
- `docs/mp5_official_images`：1.1M
- `docs/mp5_official_pages`：108K
- `scripts`：72K
- `pages`：136K
- `data`：140K
- `utils`：24K
- `config`：8K
- `styles`：4K

主要体积来自官方图片缓存和文档资料，排除上传包后不影响运行时页面和本地数据。

## 模板残留检查

检查结果：

- 未发现 `cloudfunctions/`
- 未发现嵌套 `miniprogram/`
- 未发现 `uploadCloudFunctions*`
- 运行时文件中未发现 `wx.cloud`
- 运行时文件中未发现云开发模板引用

本轮未删除任何文件。

## 数据与规则保持

本轮不修改以下数据和规则：

- 学校数量：55
- 2025 年历史分数线：103
- 2026 年历史分数线：43
- 历史分数线总数：146
- 学习目标满分：740
- AppID：`wx17e903f81714736f`

## 验证命令

本轮验证清单：

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
node scripts/verify_upload_package_ignore.js
node scripts/smoke_local_logic.js
node scripts/smoke_page_logic.js
find . -type f -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
git diff --check
```

执行结果：

- `project.config.json` JSON 解析通过。
- `node --check` 单文件检查通过。
- `verify_mp1`、`verify_mp2`、`verify_mp4`、`verify_mp5`、`verify_mp6` 通过。
- `verify_score_max_740` 通过。
- `verify_mp13_2026_scores` 通过，2026 年分数线为 43 条。
- `verify_upload_package_ignore` 通过。
- `smoke_local_logic` 和 `smoke_page_logic` 通过。
- 全量 JavaScript `node --check` 通过。
- `git diff --check` 通过。

## 重新上传体验版前检查

用户在微信开发者工具重新上传体验版前，应检查：

- 打开的项目路径是 `/Users/tom/Dev/suzhou_highschool_miniprogram`。
- AppID 显示为 `wx17e903f81714736f`。
- 编译后页面仍显示正式产品文案，不出现开发阶段说明。
- 上传前预览包不包含 `docs`、`scripts`、`README.md`、官方图片缓存或官方 HTML 缓存。
- 首页、学校库、学校详情、收藏、学习目标、数据说明和隐私说明仍可正常进入。
