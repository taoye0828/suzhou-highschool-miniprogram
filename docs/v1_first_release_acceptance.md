# 苏程记录 V1 首发验收清单

## 已由本地自动化确认

- [x] 正式名称为“苏程记录”，AppID 为 `wxc2a2a94f767438dd`。
- [x] 五个正式 Tab 与所有 included 功能入口存在。
- [x] D001—D044 均为 `fixed_verified`。
- [x] 17 类实体生命周期矩阵无缺项。
- [x] Storage Schema v5 / Backup v3 / Restore Point v2 及旧版兼容通过。
- [x] V1 共 103 个唯一 TEST-ID 通过。
- [x] 85 个历史 `verify_*.js` 逐个执行通过（`verify_v1_full.js` 自身排除，避免递归）。
- [x] smoke、全仓 JavaScript 语法、JSON、上传包、正式身份、禁用能力和正式数据哈希通过。
- [x] 正式数据保持 55 / 103 / 43 / 146，正式 2027 为 0，上限 740。

## 必须人工完成后才能确认体验冻结

- [ ] 微信开发者工具导入正确目录并识别正式 AppID。
- [ ] 普通编译成功、Problems 为 0、Console 无业务错误。
- [ ] 首页、学校库、成绩、目标规划、我的及关键二级页完整点击。
- [ ] 320 / 375 / 390 / 414 / 430 宽度与 iPad 检查。
- [ ] 备份和报告文件分别真实发送一次，并验证取消、失败和重试文案。
- [ ] 恢复点真实创建、恢复、删除至少一次。
- [ ] 多档案隔离、切换、单档案恢复与共享收藏默认不恢复真实走通。
- [ ] 手机预览、体验版上传、审核与公众平台材料由用户授权后执行。

当前状态只能写 `V1_CODE_FREEZE_READY`，不能写 `PRE_RELEASE_UX_FREEZE_CONFIRMED`。

## PRELAUNCH-FINAL-MP 2026-08-01 更新

- [x] 最终 103/103 TEST-ID 与当前 86/86 历史 `verify_*.js` 通过。
- [x] 隐私和主动分享文案已按开发者服务器、主动分享例外、可信接收方统一，并有专项门禁。
- [x] 上传包 127 个文件、880,708 字节，开发资料命中 0、必需文件缺失 0。
- [x] 正式数据数量、raw SHA-256、semantic SHA-256 与冻结基线一致。
- [ ] 开发者工具普通编译：当前登录用户不是 AppID `wxc2a2a94f767438dd` 的开发者，模拟器未创建。
- [ ] Problems、Console、五 Tab、完整用户路径、六种尺寸和真实数据恢复验收：未运行，不能写成通过。

因此 `V1_CODE_FREEZE_READY` 保持；`PRE_RELEASE_UX_FREEZE_CONFIRMED=false`；`FIRST_SUBMISSION_CODE_READY=false`。详情见 `docs/prelaunch_final_report.md`。
