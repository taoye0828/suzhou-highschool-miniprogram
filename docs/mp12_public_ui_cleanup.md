# MP12 正式展示文案收口

## 用户可见开发文案清理

- 首页不再显示开发阶段入口或阶段编号。
- 我的页删除了“提交前说明”入口。
- 我的页删除了包含 AppID、备案、隐私保护指引、真机预览等上架流程说明的弹窗。
- `config/app-config.js` 的页面状态文案已改为“本地数据版”。
- `project.config.json` 的项目描述已改为正式产品名称。

## 删除或替换的入口

- 删除：我的页“提交前说明”卡片。
- 删除：`openSubmissionNotes` 弹窗方法。
- 新增正式入口：我的收藏、学习目标。
- 保留正式入口：数据说明、隐私说明、清除本地数据。

## 首页正式内容

- 标题：苏州高中目标查询助手。
- 副标题：查询苏州高中阶段学校基础信息，查看官方来源可核验的历史录取分数线，记录阶段学习目标。
- 免责声明：历史分数线仅供了解，不判断未来录取结果。
- 本地保存说明：不登录、不上传，收藏和学习目标记录只保存在本机。
- 数据概况：已收录官方历史分数线 103 条。
- 当前版本能做什么。
- 当前版本不做什么。
- 快捷入口和使用步骤。

## 我的页正式入口

- 我的收藏。
- 学习目标。
- 数据说明。
- 隐私说明。
- 本地保存说明。
- 清除本地数据。
- 当前数据概况：收藏、学习目标、学校、历史分数线。

## 仅保留在文档中的内容

以下内容只作为维护资料保留在 README 或 docs 中，不再出现在用户可见页面：

- 历史阶段编号。
- 上架流程说明。
- 微信开发者工具操作说明。
- AppID 配置说明。
- 上传、体验版、审核相关交接材料。

## 上传包冗余文件忽略

`project.config.json` 已通过 `packOptions.ignore` 排除开发资料和临时产物：

- `docs`
- `scripts`
- `README.md`
- Markdown 文档后缀
- `.git`
- `.DS_Store`
- `node_modules`
- `package-lock.json`
- `backups`
- `tmp`
- `coverage`

## 未删除的文件

- 未删除 `docs`：保留历史证据、审核材料和维护交接记录。
- 未删除 `scripts`：保留本地验证脚本。
- 未删除 `README.md`：保留项目维护说明。
- 未删除 `data/schools.js`：保持 55 条学校数据不变。
- 未删除 `data/admission-scores.js`：保持 103 条历史分数线不变。

## 数据数量

- 学校数量：55。
- 历史分数线数量：103。

## 验证结果

- `project.config.json` JSON 校验：通过。
- `node --check app.js`：通过。
- `node --check data/schools.js`：通过。
- `node --check data/admission-scores.js`：通过。
- `node scripts/verify_mp1.js`：通过。
- `node scripts/verify_mp2.js`：通过。
- `node scripts/verify_mp4.js`：通过。
- `node scripts/verify_mp5.js`：通过。
- `node scripts/verify_mp6.js`：通过。
- `node scripts/smoke_local_logic.js`：通过。
- `node scripts/smoke_page_logic.js`：通过。
- 全量 JS `node --check`：通过。
- `git diff --check`：通过。
- 用户可见文案扫描：无命中。

## 重新编译后应看到

- 首页显示正式产品说明、数据概况、功能说明和正式边界。
- 我的页显示收藏、学习目标、数据说明、隐私说明、本地保存和清除本地数据。
- 不再看到“提交前说明”。
- 不再看到“MP6 填写 AppID 前最终收口版”。
