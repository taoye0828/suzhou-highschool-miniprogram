# PRELAUNCH-FINAL-MP 缺陷记录

## PRELAUNCH-DEFECT-001

| 字段 | 结果 |
| --- | --- |
| 标题 | 主动分享场景的隐私说明仍使用绝对“不上传”表述 |
| 严重等级 | P1（上架前隐私文案） |
| 页面或模块 | 帮助、隐私/数据说明配置、备份、报告 |
| 设备尺寸 | 与尺寸无关；开发者工具模拟器因账号权限未创建 |
| 开发者工具版本 | RC 2.02.2607171；应用 bundle 36.6.0 |
| 基础库版本 | 配置为 3.7.12；运行时因账号权限未加载 |
| 复现步骤 | 搜索用户可见帮助与备份/报告提示中的“不上传服务器”“不上传用户数据” |
| 预期结果 | 明确“不会自动上传到开发者服务器”；不主动分享时只保存在本机；主动分享会交给用户选择的微信接收方 |
| 实际结果 | 部分文案使用绝对“不上传”措辞，主动分享例外仅在相邻条目说明 |
| Console / Problems | 不适用；由静态文案审计发现 |
| 截图路径 | 无；静态证据见修改文件和专项测试 |
| 数据风险 | 不修改用户数据；风险为用户对主动分享边界理解不准确 |
| 根因 | 历史本地存储文案早于 Backup v3 / 报告主动分享能力，未统一升级 |
| 修改文件 | `config/app-config.js`、`pages/help/help.js`、`pages/backup-restore/*`、`pages/reports/*` |
| 修改函数 | `APP_CONFIG.policy`、`exportBackup`、`sendBackupFile`、`sendReportFile` |
| 专项测试 | `scripts/verify_prelaunch_final.js`；加强 `verify_mp6.js` 与 `smoke_page_logic.js` |
| 修复结果 | 已统一开发者服务器、主动分享、可信接收方、取消/失败边界 |
| 开发者工具复验 | 因当前登录用户不是正式 AppID 开发者而未完成，不伪造通过 |
| 历史回归 | 103/103 TEST-ID、86/86 verify 脚本及两个 smoke 最终通过 |
| commit | `34fc36e46a5744df4921ab141dfee0119cdfb8e8` |

## PRELAUNCH-DEFECT-002

| 字段 | 结果 |
| --- | --- |
| 标题 | 跨端隐私门禁仍绑定已替换的旧文案 |
| 严重等级 | P2（验证门禁误报，阻断最终回归） |
| 页面或模块 | `scripts/verify_cross_platform_consistency.js` |
| 设备尺寸 | 与尺寸无关 |
| 开发者工具版本 / 基础库 | 与本缺陷无关 |
| 复现步骤 | 隐私文案修复后运行 `node scripts/verify_v1_full.js --all-verify` |
| 预期结果 | 门禁验证更严格的新隐私含义 |
| 实际结果 | `miniPrivacyLocalOnly=false`，只因脚本要求旧的精确短语 |
| 错误 | `verify_cross_platform_consistency.js failed` |
| 数据风险 | 无用户数据写入；会造成发布门禁假失败 |
| 根因 | 旧断言以文案字面值替代语义契约 |
| 修改文件 / 函数 | `scripts/verify_cross_platform_consistency.js` / `miniPrivacyLocalOnly` |
| 专项测试 | 基础跨端、RC11-1 跨端、PRELAUNCH 静态门禁 |
| 修复结果 | 同时要求“开发者服务器”“不会静默/后台上传”“主动分享选择接收方” |
| 开发者工具复验 | 不适用 |
| 历史回归 | 第二次从头执行后 103/103 + 86/86 全通过 |
| commit | `b8bdb1c4d37352d2ac3bf3cac28c424f7898b4ba` |

缺陷总数 2：P0=0、P1=1、P2=1、P3=0。当前没有已知未修复代码缺陷；平台账号权限阻断单列在人工剩余事项，不伪装成代码缺陷。
