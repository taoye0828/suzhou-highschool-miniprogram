# FINAL-RC4 双端一致性报告

生成命令：`node scripts/verify_cross_platform_consistency.js ../suzhou_highschool_app --write-report`

结论：数据与本地隐私边界检查 通过（16/16 项）；Flutter 正式本地运行链路检查 通过（6/6 项）；Flutter FINAL-RC4 已完成。

| 指标 | 微信小程序 | Flutter App | 一致 |
|---|---:|---:|---|
| 学校数量 | 55 | 55 | 是 |
| 分数线总数 | 146 | 146 | 是 |
| 2025 分数线 | 103 | 103 | 是 |
| 2026 分数线 | 43 | 43 | 是 |
| 重复 schoolId | 0 | 0 | 是 |
| 重复 scoreId | 0 | 0 | 是 |
| 无效 score.schoolId | 0 | 0 | 是 |
| 超过 740 的分数 | 0 | 0 | 是 |
| 学校核心字段 SHA-256 | `a1c8c18d9364ddb30c80db61d728f78ab50d00ea2c36f7ccc405d68adc97e5be` | `a1c8c18d9364ddb30c80db61d728f78ab50d00ea2c36f7ccc405d68adc97e5be` | 是 |
| 分数线核心字段 SHA-256 | `ceba74cbebd620ef385091a6d734604cd4ffc939da4cdd2f25130460d9b945e9` | `ceba74cbebd620ef385091a6d734604cd4ffc939da4cdd2f25130460d9b945e9` | 是 |

## 学校差异

缺失：
- 无

多余：
- 无

字段变化：
- 无

## 分数线差异

缺失：
- 无

多余：
- 无

字段变化：
- 无

## 隐私和能力边界

- PASS: targetMaxEqual740
- PASS: miniNoForbiddenApi
- PASS: appNoLocationPermission
- PASS: appNoUserDataUpload
- PASS: miniPrivacyLocalOnly
- PASS: appPrivacyLocalOnly

## Flutter 正式本地运行链路

- PASS: singleLocalDataMode
- PASS: defaultRepositoriesUseLocalSources
- PASS: productionAssetsRegistered
- PASS: productionSourcesReadFormalAssets
- PASS: noRuntimeDataSourceSelector
- PASS: noMockOrSupabaseRuntime

## Flutter 运行时阻断

- 无
