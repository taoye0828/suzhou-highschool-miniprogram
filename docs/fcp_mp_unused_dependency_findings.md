# FCP 微信小程序无依赖文件定位与处理记录

- 任务：`FCP-MP-UNUSED-DEPENDENCY-CLEANUP`
- 项目：`/Users/tom/Dev/suzhou_highschool_miniprogram`
- AppID：`wxc2a2a94f767438dd`
- DevTools：微信开发者工具 RC `2.02.2607171`
- 首次扫描时间：2026-08-09 13:00
- 原始结果：代码文件未通过；插件已通过；组件已通过。

## DevTools 真实无依赖文件完整名单

已在“代码依赖分析 → 代码质量 → 无使用或无依赖文件 → 点击查看”中读取完整列表。界面显示 `1 个结果`，不是依据 grep 推测。

| 文件 | DevTools 是否判定无依赖 | 当前用途 | 是否正式运行需要 | 分类 | 处理方案 |
|---|---:|---|---:|---|---|
| `project.private.config.json` | 是 | 本机微信开发者工具私有配置；保存基础库版本、项目名和本机调试偏好；已被 `.gitignore` 排除 | 否 | `IGNORE_FROM_PACKAGE` | 在 `project.config.json` 的 `packOptions.ignore` 中加入精确 `file` 规则；不删除文件，不添加假 `require`，继续保留 `ignoreDevUnusedFiles=false` |

没有其他文件出现在 DevTools 的无依赖结果中。

## 真实运行依赖图审计

入口来自 `app.js` 与 `app.json` 注册的 10 个页面，共 11 个 JS 入口。递归解析静态 `require(...)` 后得到 61 条依赖边、30 个可达运行 JS、0 个不可达运行 JS；未发现动态 `require` 或字符串拼接模块路径。项目当前没有 `components/` 目录，也没有 `usingComponents` 注册。

依赖主干：

```text
app.js
├── config/app-config.js
│   └── utils/runtime-constants.js
└── utils/storage.js
    └── utils/rc9-storage.js
        ├── utils/rc9-models.js
        ├── utils/storage-migration.js
        ├── utils/legacy/migration/storage-keys.js
        ├── utils/rc11-stability.js
        ├── utils/v1-domain.js
        ├── utils/operation-context.js
        └── data/schools.js

app.json 注册的 10 个页面
├── data/schools.js
├── data/admission-scores.js
│   └── data/admission-scores-2026.js
├── utils/storage.js
├── utils/planning.js
├── utils/countdown.js
├── utils/backup-restore.js
│   ├── utils/canonical-json.js
│   ├── utils/checksum.js
│   └── utils/rc9-models.js
└── utils/file-share.js
```

`utils/generated/product-rules.js` 仅供生成校验和脚本测试使用，已由现有 `packOptions.ignore` 的 `utils/generated` 文件夹规则排除，分类为 `IGNORE_FROM_PACKAGE`。它不是本次 DevTools 报出的无依赖文件。

## 重点残留与兼容层结论

- `utils/rc9-storage.js`、`utils/backup-restore.js`、`utils/storage-migration.js`、`utils/rc9-models.js`、`utils/canonical-json.js`、`utils/checksum.js` 均在正式运行依赖图中，属于 `KEEP_RUNTIME` 或 `KEEP_LEGACY_COMPAT`。
- onboarding、recommendation、favorites、review、mistake、learning task、weekly plan、stage goal 等字段仍由迁移、备份恢复和旧数据规范化链路真实使用；本轮不删除兼容代码。
- `data/schools.js`、`data/admission-scores.js`、`data/admission-scores-2026.js` 均在正式运行依赖图中，保持只读。
- Clipboard 的 `wx.setClipboardData`、MessageFile 的 `wx.chooseMessageFile` 以及备份文件主动发送链路仍有真实调用，不做清理。

## 根因

`project.private.config.json` 是 DevTools 本机开发配置，不属于小程序运行模块，也不应上传；它已被 Git 忽略，但 `project.config.json` 的上传包忽略规则没有显式覆盖它，因此代码依赖分析仍把它列为无依赖代码文件。

## 处理顺序

1. Phase 1：把 `project.private.config.json` 作为精确开发文件加入 `packOptions.ignore`，并给上传包门禁增加回归断言。
2. Phase 2：本次没有 DevTools 判定的业务死代码，不删除任何运行文件。
3. Phase 3：本次没有动态或间接依赖缺口，不增加任何 `require`。
4. Phase 4：运行 Schema/Backup/Restore、正式数据、隐私接口与完整 FCP 门禁，确认兼容层不受影响。
5. Phase 5：DevTools 普通编译与重新扫描，只有“代码文件”实际变为已通过才关闭本问题。

## 禁止项确认

- 不把 `ignoreDevUnusedFiles` 改为 `true`。
- 不通过假 `require` 欺骗依赖扫描。
- 不批量删除 DevTools 建议项。
- 不删除正式数据、TabBar 资源或旧备份兼容代码。

## 修改与复扫结果

- `project.config.json`：新增 `{ "value": "project.private.config.json", "type": "file" }`。
- `scripts/verify_upload_package_ignore.js`：新增精确规则存在性和匹配行为断言。
- 删除文件：0。
- 新增运行依赖：0。
- 2026-08-09 14:26 DevTools 重新扫描：`0 个结果`，并显示“小程序表现良好，未发现代码质量问题”。
- 无使用或无依赖文件：代码文件、插件、组件全部通过。
- 主包：主包大小、未使用 JS、未使用组件 3/3 通过。
- 代码压缩：JS、WXML、WXSS 3/3 通过。
- 代码包：组件按需注入、插件大小、图片和音频资源 3/3 通过。
- 敏感信息：AppSecret 1/1 通过。

## 自动验证结果

- `verify_fcp_mp_first_release.js`：PASS，13 TEST-ID。
- `verify_dual_final_hardening.js`：PASS。
- `verify_dual_rc1_matching_flows.js`：PASS（已委托当前 FCP 合同）。
- `verify_v1_final_ux.js`：PASS（已委托当前 FCP 合同）。
- `verify_rc9_full.js`：PASS（已委托当前 FCP 合同）。
- `verify_v1_full.js --all-verify`：PASS，7 个当前 release gates。
- `smoke_local_logic.js`、`smoke_page_logic.js`：PASS。
- `verify_upload_package_ignore.js`：PASS。
- `verify_score_max_740.js`、`verify_mp13_2026_scores.js`：PASS。
- 全仓 142 个 JS `node --check`：PASS。
- 全仓 28 个 JSON 解析：PASS。
- `git diff --check`：PASS。

额外只读探测的旧 `verify_rc10_post_audit.js` 不在当前 release suite 中，仍期待已淘汰的 Tab 文案“目标规划”，单独运行 FAIL。当前正式文案“目标”由 FCP 与 V1 当前门禁确认正确；不为旧脚本恢复旧产品文案。此项记录为 P2 历史测试脚本清理，不影响本轮 P0/P1 或当前 release gates。

## DevTools 编译与模拟器

- 普通编译：PASS。
- Problems：0。
- Console：无业务 Error；仅 3 条 DevTools 系统、自动热重载或预加载资源警告。
- 五个 Tab：`pages/home/home`、`pages/schools/schools`、`pages/score-trend/score-trend`、`pages/targets/targets`、`pages/profile/profile` 均实际切换并渲染。
- 学校详情、数据备份与恢复、使用说明、隐私说明均实际打开，无白屏。
- 未出现 `module ... is not defined`、`wx://not-found`、`MaxCodeSize` 或 `MinTabbarCount`。

## 正式数据复核

- 学校：55。
- 2025 分数线：103。
- 2026 分数线：43。
- 总数：146。
- 分数上限：740；当前数据实际最高分：731；`>740`：0。
- 三份正式数据 SHA-256 与任务开始前完全一致。
- AppID：`wxc2a2a94f767438dd`。
- `ignoreDevUnusedFiles=false`；`uploadWithSourceMap=false`。
