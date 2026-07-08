# MP12 上传包冗余文件清理报告

## 检查范围

- 项目根目录。
- `project.config.json` 的 `packOptions.ignore`。
- `docs`、`scripts`、`README.md` 等开发资料。
- `cloudfunctions`、`miniprogram`、`uploadCloudFunctions` 类模板残留。

## 检查到的冗余文件或目录

- `docs`：历史文档、审核材料、来源证据和维护交接资料。
- `scripts`：本地验证脚本。
- `README.md`：项目维护说明。
- Markdown 文档：维护资料，不应进入上传包。

## 通过 packOptions.ignore 排除

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

## 未删除内容和原因

- 未删除 `docs`：后续审核、数据来源回查、历史交接仍需要。
- 未删除 `scripts`：本地验证必须依赖这些脚本。
- 未删除 `README.md`：维护者需要项目状态、验证命令和回滚说明。
- 未删除 MP 历史文档：这些是历史交付和审核证据，不影响上传包。

## 错误模板残留检查

- `cloudfunctions` 目录：未发现。
- `miniprogram` 子目录：未发现。
- `uploadCloudFunctions` 类文件：未发现。

## 是否删除文件

- 本轮未直接删除任何文件。
- 清理方式为修改 `packOptions.ignore`，让上传包排除开发资料。

## 风险说明

- 微信开发者工具左侧仍可能显示 `docs`、`scripts`、`README.md`，这不代表上传包包含它们。
- `packOptions.ignore` 依赖微信开发者工具打包逻辑，提交前仍建议在开发者工具中重新编译并查看上传包体积。
- 本轮未删除历史文档，避免破坏后续维护和验证链路。
