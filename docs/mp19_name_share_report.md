# MP19 名称同步与页面分享修复报告

生成日期：2026-08-20

## 本轮背景

1. 微信小程序已完成认证、可被搜索到，但无法分享给好友、无法复制小程序链接。
2. 小程序正式名称由“苏程记录”统一改为“学程记录”。

本轮不改变产品定位、页面功能、正式数据、算法、本地存储、底部导航、AppID、登录边界或后台链路。

## 分享失败原因

审计确认仓库运行时代码中没有任何 `onShareAppMessage`、`onShareTimeline`、`wx.showShareMenu` 或 `wx.hideShareMenu` 调用；页面配置与 `app.json` 也没有分享相关配置。MP17 报告亦确认“仓库原本没有 `onShareAppMessage`、`onShareTimeline` 或自定义分享标题处理器”。

微信平台规则：页面未定义 `onShareAppMessage` 时，右上角菜单不显示“转发给朋友”，也没有“复制链接”入口；未定义 `onShareTimeline` 时没有“分享到朋友圈”。因此认证正常、可被搜索，但分享入口整体缺失。

已有 `utils/file-share.js` 的 `wx.shareFileMessage` 是备份文件发送能力，与页面分享无关。

修复方式：新增 `utils/share.js` 统一分享配置（标题取 `APP_CONFIG.name`，即“学程记录”），并为首页、学校库、学校详情、成绩、目标 5 个页面同时添加 `onShareAppMessage` 与 `onShareTimeline`。所有分享路径均为 `app.json` 中真实注册的页面，不新增页面、不新增登录/用户系统/后台/权限。学校详情分享携带 `id` 参数，落到真实学校页。

注意：首页真实路径是 `pages/home/home`（`app.json` 首页），仓库中不存在 `pages/index/index`，按“分享路径必须真实存在、不生成不存在页面”的要求，未创建该路径。

上传审核通过前，线上版本分享行为不变；需用微信开发者工具重新上传并经审核发布后生效。若发布后“分享到朋友圈”仍不可用，请到小程序后台确认主体类型是否支持朋友圈分享（个人主体暂不支持），代码层面已就绪。

## 名称迁移范围

### 运行时与配置（已替换）

- `utils/runtime-constants.js`：`PRODUCT_RULES.productName`。
- `shared-spec/product_rules_v1.json`：权威规则源 `productName`；`utils/generated/product-rules.js` 已由 `scripts/generate_product_rules.js` 重新生成。
- `app.json`：全局导航标题。
- `project.config.json`：`description` 与 `projectname`；AppID、`compileType`、`miniprogramRoot`、`packOptions.ignore` 均未改变。
- `utils/backup-restore.js`：备份说明文案改为从 `PRODUCT_RULES.productName` 读取。
- `pages/privacy/privacy.js`、`pages/backup-restore/backup-restore.wxml`：隐私与备份界面文案。
- `utils/share.js`（新增）：分享标题统一使用 `APP_CONFIG.name`。
- `app.js`：继续通过 `APP_CONFIG.name` 提供 `appName`，无需改动。

### README 与当前文档（已替换）

- `README.md`。
- `docs/current_release_gates.md`、`docs/manual_wechat_release_checks.md`、`docs/user_final_acceptance_checklist.md`。

### 验证脚本

- `scripts/verify_mp5.js`：名称断言已同步。
- 新增 `scripts/verify_mp19_name_sync.js`：覆盖名称清零、历史文件保留、分享函数、分享路径真实性、功能页标题、AppID、数据基线（55/103/43/146/740）、登录与云开发能力边界、AppSecret。
- `scripts/verify_mp17_name_sync.js`、`scripts/verify_mp18_name_sync.js` 因 2.0 已移除 `components/`、`pages/data-info`、`utils/onboarding` 而失效，`scripts/verify_rc9_onboarding_help.js` 依赖已删除的 `utils/onboarding` 模块；三者作为历史轮次快照原样归档到 `scripts/legacy/`，未做内容改写。

### 历史记录（保留原样，仅在此标记）

以下文件记录的是当时轮次的历史事实，其中出现的旧名称不做改写：

- 历史轮次报告：`docs/mp17_name_sync_report.md`、`docs/mp18_name_sync_report.md`、`docs/mp1_review_materials.md`、`docs/mp2_review_materials.md`、`docs/mp7_wechat_upload_quick_guide.md`、`docs/mp12_public_ui_cleanup.md`、`docs/rc7_full_upgrade_report.md`、`docs/rc8_chart_vertical_alignment_hotfix_report.md`、`docs/rc9_full_upgrade_report.md`、`docs/rc10_full_upgrade_report.md`、`docs/rc11_1_full_report.md`、`docs/rc11_2_full_report.md`、`docs/rc11_final_full_report.md`、`docs/rc11_final_evidence.json`、`docs/prelaunch_*`、`docs/v1_*`、`docs/final_rc4_*`、`docs/final_rc6_upgrade_report.md`、`docs/fcp_mp_deep_code_audit_findings.md`、`docs/wechat_review_v1.md`、`docs/wechat_review_1_2_0.md`、`docs/release_notes_v1.md`、`docs/release_notes_1_2_0.md`、`docs/miniprogram_cross_platform_audit_report.md`、`docs/archive/*`。
- 历史验证脚本：`scripts/legacy/*`（含本轮归档的 3 个）、`scripts/v1/release-freeze-suite.js`。

`scripts/verify_mp19_name_sync.js` 会持续断言这些历史文件未被改写。

## 验证结果

- `scripts/verify_mp19_name_sync.js`：通过（名称清零、5 页分享函数与真实路径、数据基线与 AppID 不变）。
- `scripts/verify_mp5.js`、`verify_mp6.js`、`verify_fcp_mp_first_release.js`、`verify_dual_final_hardening.js`、`verify_dual_rc1_matching_flows.js`、`verify_product_rules_generated.js`、`smoke_local_logic.js`、`smoke_page_logic.js`、`verify_upload_package_ignore.js`：通过。
- 其余现有脚本逐一运行，结果见提交说明与最终报告。
- 全仓 `.js` 通过 `node --check` 语法检查；`git diff --check` 无空白错误。

## 边界

- 未新增页面、登录、用户系统、后台、权限或网络能力；`wx.request` 仅保留 1.2.0 起已有的远程公开数据链路。
- 未修改 `packOptions.ignore`、Sitemap、底部导航、数据文件与存储结构。
- 禁止 `git reset`、`git clean`、force push 与 `git add .`，本轮回滚使用 `git revert`。
